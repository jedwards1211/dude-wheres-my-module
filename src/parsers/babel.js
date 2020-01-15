// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
} from '../ASTTypes'
import type { Parser, UndefinedIdentifier } from './Parser'
import jscodeshift from 'jscodeshift'
import builtinIdentifiers from '../util/builtinIdentifiers'

import babelConvertRequiresToImports from './babelConvertRequiresToImports'

import findRoot from 'find-root'
import { type VariableDeclaration } from '../ASTTypes'
import typescriptTypeIdentifiers from '../util/typescriptTypeIdentifiers'
import flowTypeIdentifiers from '../util/flowTypeIdentifiers'
const j = jscodeshift.withParser('babylon')

type Node = Object

type Binding = Object

type Scope = {
  types: { [name: string]: Array<NodePath> },
  getBinding(name: string): ?Binding,
  registerBinding(
    kind: string,
    path: NodePath,
    bindingPath?: NodePath
  ): Binding,
}

type NodePath = {
  value: any,
  parent: ?Node,
  parentPath: ?NodePath,
  node: Node,
  scope: ?Scope,
  get(...path: Array<number | string>): NodePath,
  typeParameters: ?{ [name: string]: Array<NodePath> },
  isTypeParameterDeclaration: () => boolean,
  isTSTypeParameterDeclaration: () => boolean,
}

function lookupTypeParameter(path: ?NodePath, name: string): ?NodePath {
  while (path) {
    const typeParameters = path.get('typeParameters')
    if (
      typeParameters.isTypeParameterDeclaration() ||
      typeParameters.isTSTypeParameterDeclaration()
    ) {
      const params: Array<NodePath> = (typeParameters.get('params'): any)
      return Array.isArray(params)
        ? params.find(p => p.node.name === name)
        : null
    }
    path = path.parentPath
  }
}

export default class BabelParser implements Parser {
  options: ?Object

  constructor(options?: Object) {
    this.options = options
  }
  getMode({
    code,
    file,
  }: {
    code: string,
    file?: string,
  }): 'import' | 'require' {
    if (file && /\.tsx?$/i.test(file)) return 'import'

    const projectDirectory = findRoot(file)

    // $FlowFixMe
    const babel = require(require.resolve('@babel/core', {
      paths: [projectDirectory],
    }))

    const ast = babel.parse(code, {
      cwd: projectDirectory,
      filename: file,
    })

    const { comments, program } = ast
    if (comments) {
      for (let comment of comments) {
        if (/@flow/.test(comment.value)) {
          return 'import'
        }
      }
    }

    if (program) {
      const { body } = program
      if (Array.isArray(body)) {
        for (let s of body) {
          if (s.type === 'ImportDeclaration') return 'import'
        }
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
    file,
  }: {
    code: string,
    file?: string,
  }): Array<UndefinedIdentifier> {
    const projectDirectory = findRoot(file)

    const isTypeScript = file && /\.tsx?/i.test(file)

    // $FlowFixMe
    const babel = require(require.resolve('@babel/core', {
      paths: [projectDirectory],
    }))
    // $FlowFixMe
    const traverse = require(require.resolve('@babel/traverse', {
      paths: [projectDirectory],
    })).default

    const ast = babel.parse(code, {
      ...this.options,
      cwd: projectDirectory,
      filename: file,
    })

    const lines = code.split(/\r\n?|\n/gm)

    const identifiers = []

    traverse(ast, {
      TSTypeAliasDeclaration(path: NodePath) {
        const { scope } = path
        if (!scope) return
        scope.registerBinding('type', path.get('id'))
      },
    })

    traverse(ast, {
      Identifier(path: NodePath) {
        const { node, scope, parent, parentPath } = path
        if (!scope || !parent || !parentPath) return
        if (scope.getBinding(node.name)) return

        let isType = false

        switch (parent.type) {
          case 'TSFunctionType':
            if (parent.parameters.includes(node)) return
            break
          case 'GenericTypeAnnotation':
          case 'TSTypeReference':
            isType = true
            break
          case 'TSQualifiedName':
            if (parent.right === node) return
            isType = parent.left === node
            break
          case 'QualifiedTypeIdentifier':
            if (parent.id === node) return
            isType = parent.qualification === node
            break
          case 'ImportDefaultSpecifier':
          case 'ImportNamespaceSpecifier':
          case 'ImportSpecifier':
          case 'FunctionTypeParam':
          case 'RestElement':
          case 'RestProperty':
          case 'OpaqueType':
            return
          case 'MemberExpression':
          case 'OptionalMemberExpression':
            if (parent.property === node && !parent.computed) return false
            break
          case 'ExportSpecifier':
          case 'ExportNamespaceSpecifier':
            if (parentPath.parent && parentPath.parent.source) return
            if (parent.exported === node) return
            break
          case 'TSTypeAliasDeclaration':
          case 'ObjectTypeIndexer':
          case 'TypeAlias':
          case 'ClassDeclaration':
          case 'TSInterfaceDeclaration':
          case 'VariableDeclarator':
            if (parent.id === node) return
            break
          case 'ObjectMethod':
          case 'ClassMethod':
            if (parent.key === node && !parent.computed) return
            break
          case 'ObjectTypeProperty':
          case 'ClassProperty':
          case 'MethodDefinition':
          case 'ObjectProperty': {
            if (
              parent.key === node &&
              !parent.computed &&
              (!parent.value ||
                parent.value.type !== node.type ||
                parent.value.name !== node.name)
            ) {
              return
            }
            break
          }
          case 'ArrowFunctionExpression':
          case 'FunctionExpression':
          case 'FunctionDeclaration':
            if (parent.id === node) return false
            if (parent.params.indexOf(node) >= 0) return
            break
        }

        if (isType) {
          if (isTypeScript) {
            if (typescriptTypeIdentifiers.has(node.name)) return
          } else {
            if (flowTypeIdentifiers.has(node.name)) return
          }
          if (lookupTypeParameter(path, node.name)) return
        } else {
          if (builtinIdentifiers.has(node.name)) return
        }

        const { name: identifier, loc } = node
        if (loc && loc.start && loc.start.line != null) {
          const { start, end } = loc
          identifiers.push({
            identifier,
            start,
            end,
            context: lines[start.line - 1],
            kind:
              parent.type === 'GenericTypeAnnotation' &&
              (parentPath.parent && parentPath.parent.type) !==
                'TypeofTypeAnnotation'
                ? 'type'
                : 'value',
          })
        }
      },
      JSXIdentifier(path: NodePath) {
        const { node, scope, parent, parentPath } = path
        if (!scope || !parent || !parentPath) return
        if (builtinIdentifiers.has(node.name)) return

        if (scope.getBinding(node.name)) return

        switch (parent.type) {
          case 'JSXOpeningElement':
            if (node.name[0].toLowerCase() === node.name[0]) {
              return
            }
            break
          case 'JSXClosingElement':
          case 'JSXAttribute':
            return
          case 'JSXMemberExpression':
            if (parent.property === node && !parent.computed) return
            break
        }
        const { name: identifier, loc } = node
        if (loc && loc.start && loc.start.line != null) {
          const { start, end } = loc
          identifiers.push({
            identifier,
            start,
            end,
            context: lines[start.line - 1],
            kind: 'value',
          })
        }
      },
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

  async parse({
    code,
    file,
  }: {
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
    if (!file) {
      throw new Error(
        `calling BabelParser.parse without a file isn't currently supported`
      )
    }

    const projectDirectory = findRoot(file)

    // $FlowFixMe
    const babel = require(require.resolve('@babel/core', {
      paths: [projectDirectory],
    }))
    // $FlowFixMe
    const traverse = require(require.resolve('@babel/traverse', {
      paths: [projectDirectory],
    })).default

    const ast = await babel.parseAsync(code, {
      cwd: projectDirectory,
      filename: file,
    })

    function* declarations(): Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    > {
      const result = []

      const addPath = (path: NodePath) => {
        result.push(path.node)
      }

      traverse(ast, {
        ImportDeclaration: addPath,
        ExportNamedDeclaration: addPath,
        ExportDefaultDeclaration: addPath,
        ExportAllDeclaration: addPath,
        DeclareModule: addPath,
      })
      yield* result
      yield* (babelConvertRequiresToImports(ast, { projectDirectory }): any)
    }
    return declarations()
  }
}
