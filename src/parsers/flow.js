// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
} from '../ASTTypes'
import { parse } from 'flow-parser'
import type { Parser, UndefinedIdentifier } from './Parser'
import jscodeshift from 'jscodeshift'
import { namedTypes, Type } from 'ast-types'
import builtinIdentifiers from '../util/builtinIdentifiers'

import convertRequiresToImports from './convertRequiresToImports'

import { type VariableDeclaration } from '../ASTTypes'

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
  getMode({ code }: { code: string, file?: string }): 'import' | 'require' {
    const ast = parse(code, {
      esproposal_decorators: true,
      esproposal_class_instance_fields: true,
      esproposal_class_static_fields: true,
      esproposal_export_star_as: true,
      esproposal_optional_chaining: true,
      esproposal_nullish_coalescing: true,
    })

    const { body, comments } = ast
    if (comments) {
      for (let comment of comments) {
        if (/@flow/.test(comment.value)) {
          return 'import'
        }
      }
    }

    if (Array.isArray(body)) {
      for (let s of body) {
        if (s.type === 'ImportDeclaration') return 'import'
      }
    }

    return 'require'
  }
  requireDeclaration(code: string): VariableDeclaration {
    const ast = j.template.statement([code])
    if (ast.type !== 'VariableDeclaration') {
      throw new Error(`not a variable declaration: ${code}`)
    }
    return ast
  }
  importDeclaration(code: string): ImportDeclaration {
    const ast = j.template.statement([code])
    if (ast.type !== 'ImportDeclaration') {
      throw new Error(`not an import declaration: ${code}`)
    }
    return ast
  }
  getUndefinedIdentifiers({
    code,
  }: {
    code: string,
    file?: string,
  }): Array<UndefinedIdentifier> {
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
          scope.lookup(node.name) ||
          scope.lookupType(node.name) ||
          lookupTypeParameter(path, node.name)
        ) {
          return false
        }

        switch (parent.type) {
          case 'JSXOpeningElement':
            if (node.name[0].toLowerCase() === node.name[0]) {
              return false
            }
            break
          case 'JSXClosingElement':
          case 'JSXAttribute':
          case 'ImportDefaultSpecifier':
          case 'ImportNamespaceSpecifier':
          case 'ImportSpecifier':
          case 'FunctionTypeParam':
          case 'RestElement':
          case 'RestProperty':
          case 'OpaqueType':
            return false
          case 'MemberExpression':
          case 'OptionalMemberExpression':
          case 'JSXMemberExpression':
            if (parent.property === node && !parent.computed) return false
            break
          case 'ExportSpecifier':
          case 'ExportNamespaceSpecifier':
            if (parentPath.parent && parentPath.parent.node.source) return false
            if (parent.exported === node) return false
            break
          case 'ObjectTypeIndexer':
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
            if (
              parent.key === node &&
              !parent.computed &&
              (!parent.value ||
                parent.value.type !== node.type ||
                parent.value.name !== node.name)
            ) {
              return false
            }
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
      .paths()
      .map((path: NodePath) => {
        const {
          node: {
            name: identifier,
            loc: { start, end },
          },
          parent: parentPath,
        } = path
        return {
          identifier,
          start,
          end,
          context: lines[start.line - 1],
          kind:
            parentPath &&
            parentPath.node.type === 'GenericTypeAnnotation' &&
            (parentPath.parent && parentPath.parent.node.type) !==
              'TypeofTypeAnnotation'
              ? 'type'
              : 'value',
        }
      })
    const uniqIdentifiers = new Map()
    identifiers.forEach((i: UndefinedIdentifier) => {
      const { identifier, kind } = i
      const existing = uniqIdentifiers.get(identifier)
      if (kind === 'value' && (!existing || existing.kind !== 'value'))
        uniqIdentifiers.set(identifier, i)
      else if (!existing) uniqIdentifiers.set(identifier, i)
    })
    return [...uniqIdentifiers.values()]
  }

  async parse(options: {
    code: string,
    file?: string,
  }): Promise<
    Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  > {
    const { code } = options

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
      yield* (convertRequiresToImports(ast): any)
    }
    return declarations()
  }
}
