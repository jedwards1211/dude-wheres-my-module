// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
} from '../ASTTypes'
import { readFile } from 'fs-extra'
import { parse } from 'flow-parser'
import type { Parser, UndefinedIdentifier } from './Parser'
import jscodeshift from 'jscodeshift'
import { sortBy, uniqBy } from 'lodash'
import { namedTypes, Type } from 'ast-types'
import builtinIdentifiers from '../util/builtinIdentifiers'

const j = jscodeshift.withParser('flow')

type Node = Object

type Scope = {
  types: { [name: string]: Array<NodePath> },
  lookup(name: string): ?Scope,
  lookupType(name: string): ?Scope,
}

type NodePath = {
  value: any,
  parent: ?NodePath,
  node: Node,
  scope: ?Scope,
  get(...path: Array<number | string>): NodePath,
  typeParameters: ?{ [name: string]: Array<NodePath> },
}

// These types introduce scopes that are restricted to type parameters in
// Flow (this doesn't apply to ECMAScript).
const typeParameterScopeTypes = [
  namedTypes.Function,
  namedTypes.ClassDeclaration,
  namedTypes.ClassExpression,
  namedTypes.InterfaceDeclaration,
  namedTypes.TypeAlias,
]

const TypeParameterScopeType = Type.or.apply(Type, typeParameterScopeTypes)

export default class FlowParser implements Parser {
  getUndefinedIdentifiers(code: string): Array<UndefinedIdentifier> {
    const lines = code.split(/\r\n?|\n/gm)
    const root = j(code)

    function addTypePattern(
      patternPath: NodePath,
      types: $PropertyType<Scope, 'types'>
    ) {
      var pattern = patternPath.value

      if (Object.prototype.hasOwnProperty.call(types, pattern.name)) {
        types[pattern.name].push(patternPath)
      } else {
        types[pattern.name] = [patternPath]
      }
    }

    function addTypeParameter(
      parameterPath: NodePath,
      typeParameters: { [name: string]: Array<NodePath> }
    ) {
      const parameter = parameterPath.value

      if (
        parameter &&
        Object.prototype.hasOwnProperty.call(typeParameters, parameter.name)
      ) {
        typeParameters[parameter.name].push(parameterPath)
      } else {
        typeParameters[parameter.name] = [parameterPath]
      }
    }

    root.find(j.InterfaceDeclaration).forEach((path: NodePath) => {
      const { scope } = path
      if (!scope) return
      addTypePattern(path.get('id'), scope.types)
    })

    function getScopeTypeParameters(
      path: ?NodePath
    ): ?{ [name: string]: Array<NodePath> } {
      while (path && !TypeParameterScopeType.check(path.node)) {
        path = path.parent
      }
      if (!path) return null
      let typeParameters = path.typeParameters || (path.typeParameters = {})
      return typeParameters
    }

    root.find(j.TypeParameterDeclaration).forEach((path: NodePath) => {
      const params = path.get('params')
      for (let i = 0; i < params.value.length; i++) {
        const typeParameters = getScopeTypeParameters(path)
        if (typeParameters) addTypeParameter(params.get(i), typeParameters)
      }
    })

    function lookupTypeParameter(path: ?NodePath, name: string): ?NodePath {
      while (path) {
        const typeParameters = getScopeTypeParameters(path)
        if (typeParameters && typeParameters[name]) return path
        path = path.parent
      }
      return null
    }

    const identifiers = root
      .find(j.Identifier)
      .filter((path: NodePath) => {
        const { node, scope, parent: parentPath } = path
        if (!scope || !parentPath) return false
        if (builtinIdentifiers.has(node.name)) return false

        const parent = parentPath.node

        if (
          node.type === 'JSXIdentifier' ||
          scope.lookup(node.name) ||
          scope.lookupType(node.name) ||
          lookupTypeParameter(path, node.name)
        ) {
          return false
        }

        switch (parent.type) {
          case 'ImportDefaultSpecifier':
          case 'ImportNamespaceSpecifier':
          case 'ImportSpecifier':
            return false
          case 'MemberExpression':
            if (parent.property === node) return false
            break
          case 'QualifiedTypeIdentifier':
          case 'TypeAlias':
          case 'ClassDeclaration':
          case 'VariableDeclarator':
            if (parent.id === node) return false
            break
          case 'ObjectTypeProperty':
          case 'ClassProperty':
          case 'MethodDefinition':
          case 'Property': {
            if (parent.key === node) return parent.value !== node
            break
          }
          case 'ArrowFunctionExpression':
          case 'FunctionExpression':
          case 'FunctionDeclaration':
            if (parent.id === node) return false
            if (parent.params.indexOf(node) >= 0) return false
            break
        }

        return node.loc && node.loc.start && node.loc.start.line != null
      })
      .nodes()
      .map((node: Object) => {
        const {
          name: identifier,
          loc: { start, end },
        } = node
        return { identifier, start, end, context: lines[start.line - 1] }
      })
    return sortBy(uniqBy(identifiers, i => i.identifier), i => i.identifier)
  }

  async parse(
    options: {| file: string |} | {| code: string |}
  ): Promise<
    Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  > {
    const code = options.file
      ? await readFile(options.file, 'utf8')
      : options.code || ''

    const ast = parse(code, {
      esproposal_decorators: true,
      esproposal_class_instance_fields: true,
      esproposal_class_static_fields: true,
      esproposal_export_star_as: true,
      esproposal_optional_chaining: true,
      esproposal_nullish_coalescing: true,
    })

    function* declarations(): Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    > {
      const body = ast.type === 'File' ? ast.program.body : ast.body
      for (let declaration of body) {
        switch (declaration.type) {
          case 'ImportDeclaration':
          case 'ExportNamedDeclaration':
          case 'ExportDefaultDeclaration':
          case 'ExportAllDeclaration':
          case 'DeclareModule':
            yield declaration
            break
        }
      }
    }
    return declarations()
  }
}
