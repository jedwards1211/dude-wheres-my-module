/**
 * @flow
 * @prettier
 */

import { pick } from 'lodash'
import { type ImportSpecifier } from '../ASTTypes'
import { resolveInDir } from '../util/resolveInDir'

export default async function* babelConvertRequiresToImports(
  ast: any,
  { projectDirectory }: { projectDirectory: string }
): AsyncIterable<ImportSpecifier> {
  // $FlowFixMe
  const t = require(await resolveInDir('@babel/types', projectDirectory))
  // $FlowFixMe
  const traverse = require(await resolveInDir(
    '@babel/traverse',
    projectDirectory
  )).default

  function* convertObjectPatternToImportSpecifiers(
    pattern: any
  ): Iterable<ImportSpecifier> {
    if (!t.isObjectPattern(pattern)) {
      throw new Error('expected an ObjectPattern')
    }
    for (let property of pattern.properties) {
      if (!t.isIdentifier(property.key) || !t.isIdentifier(property.value)) {
        return
      }
      yield t.importSpecifier(
        t.identifier(property.value.name),
        t.identifier(property.key.name)
      )
    }
  }

  function getDeclaratorPath(identifierPath: any): any {
    const {
      scope,
      node: { name },
    } = identifierPath
    const binding = scope.getBinding(name)
    if (binding && binding.path && binding.path.isVariableDeclarator()) {
      return binding.path
    }
  }

  function checkStringLiteral(node: any): boolean {
    return (
      t.isStringLiteral(node) ||
      (t.isLiteral(node) && typeof node.value === 'string')
    )
  }

  function isRequireCall(path: any): boolean {
    if (!path.isCallExpression()) return false
    const {
      scope,
      node: { callee, arguments: args },
    } = path
    return (
      callee.name === 'require' &&
      !scope.getBinding('require') &&
      args.length === 1 &&
      checkStringLiteral(args[0])
    )
  }

  function getRequireSource(path: any): any {
    const initPath = path.get('init')

    if (initPath.isIdentifier()) {
      const parentDeclaratorPath = getDeclaratorPath(initPath)
      if (parentDeclaratorPath) return getRequireSource(parentDeclaratorPath)
    } else if (isRequireCall(initPath)) {
      const {
        node: { arguments: args },
      } = initPath
      return pick(args[0], 'type', 'value', 'raw')
    }
  }

  const requires = []

  traverse(ast, {
    VariableDeclarator(path: any) {
      const {
        node: { id },
      } = path

      const source = getRequireSource(path)

      if (source) {
        if (t.isIdentifier(id)) {
          requires.push(
            t.importDeclaration(
              [t.importDefaultSpecifier(t.identifier(id.name))],
              source
            )
          )
        } else if (t.isObjectPattern(id)) {
          requires.push(
            t.importDeclaration(
              [...convertObjectPatternToImportSpecifiers(id)],
              source
            )
          )
        }
      }
    },
    MemberExpression(path: any) {
      const {
        node: { property },
      } = path
      const objectPath = path.get('object')
      if (objectPath.isIdentifier() && t.isIdentifier(property)) {
        const declaratorPath = getDeclaratorPath(objectPath)
        const source = declaratorPath && getRequireSource(declaratorPath)
        if (source) {
          requires.push(
            t.importDeclaration(
              [
                t.importSpecifier(
                  t.identifier(property.name),
                  t.identifier(property.name)
                ),
              ],
              source
            )
          )
        }
      } else if (isRequireCall(objectPath) && t.isIdentifier(property)) {
        const source = { ...objectPath.node.arguments[0] }
        requires.push(
          t.importDeclaration(
            [
              t.importSpecifier(
                t.identifier(property.name),
                t.identifier(property.name)
              ),
            ],
            source
          )
        )
      }
    },
  })
  for (const req of requires) yield req
}
