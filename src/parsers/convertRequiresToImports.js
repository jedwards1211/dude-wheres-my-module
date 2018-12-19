/**
 * @flow
 * @prettier
 */

import { visit, namedTypes, builders as b } from 'ast-types'
import { pick } from 'lodash'
import { type ImportSpecifier } from '../ASTTypes'

export function* convertObjectPatternToImportSpecifiers(
  pattern: any
): Iterable<ImportSpecifier> {
  namedTypes.ObjectPattern.assert(pattern)
  for (let property of pattern.properties) {
    if (
      !namedTypes.Identifier.check(property.key) ||
      !namedTypes.Identifier.check(property.value)
    ) {
      return
    }
    yield b.importSpecifier(
      b.identifier(property.key.name),
      b.identifier(property.value.name)
    )
  }
}

function getDeclaratorPath(identifierPath: any): any {
  const {
    scope,
    node: { name },
  } = identifierPath
  const declaringScope = scope.lookup(name)
  if (!declaringScope) return
  const bindings = declaringScope.getBindings()[name]
  if (!bindings || !bindings.length) return
  const binding = bindings[0]
  if (
    binding &&
    binding.parentPath &&
    namedTypes.VariableDeclarator.check(binding.parentPath.node)
  ) {
    return binding.parentPath
  }
}

function checkStringLiteral(node: any): boolean {
  return (
    namedTypes.StringLiteral.check(node) ||
    (namedTypes.Literal.check(node) && typeof node.value === 'string')
  )
}

function isRequireCall(callExpressionPath: any): boolean {
  if (!namedTypes.CallExpression.check(callExpressionPath.node)) return false
  const {
    scope,
    node: { callee, arguments: args },
  } = callExpressionPath
  return (
    callee.name === 'require' &&
    !scope.lookup('require') &&
    args.length === 1 &&
    checkStringLiteral(args[0])
  )
}

function getRequireSource(declaratorPath: any): any {
  const { scope } = declaratorPath

  const initPath = declaratorPath.get('init')

  if (namedTypes.Identifier.check(initPath.node)) {
    const parentDeclaratorPath = getDeclaratorPath(initPath)
    if (parentDeclaratorPath) return getRequireSource(parentDeclaratorPath)
  } else if (isRequireCall(initPath)) {
    const {
      node: { arguments: args },
    } = initPath
    return pick(args[0], 'type', 'value', 'raw')
  }
}
export default function* convertRequiresToImports(
  ast: any
): Iterable<ImportSpecifier> {
  const requires = []

  visit(ast, {
    visitVariableDeclarator(path: any): ?false {
      const {
        node: { id },
      } = path

      const source = getRequireSource(path)

      if (source) {
        if (namedTypes.Identifier.check(id)) {
          requires.push(
            b.importDeclaration(
              [b.importDefaultSpecifier(b.identifier(id.name))],
              source
            )
          )
        } else if (namedTypes.ObjectPattern.check(id)) {
          requires.push(
            b.importDeclaration(
              [...convertObjectPatternToImportSpecifiers(id)],
              source
            )
          )
        }
      }
      this.traverse(path)
    },
    visitMemberExpression(path: any): ?false {
      const {
        node: { property },
      } = path
      const objectPath = path.get('object')
      if (
        namedTypes.Identifier.check(objectPath.node) &&
        namedTypes.Identifier.check(property)
      ) {
        const declaratorPath = getDeclaratorPath(objectPath)
        const source = declaratorPath && getRequireSource(declaratorPath)
        if (source) {
          requires.push(
            b.importDeclaration(
              [b.importSpecifier(b.identifier(property.name))],
              source
            )
          )
        }
      } else if (
        isRequireCall(objectPath) &&
        namedTypes.Identifier.check(property)
      ) {
        const source = { ...objectPath.node.arguments[0] }
        requires.push(
          b.importDeclaration(
            [b.importSpecifier(b.identifier(property.name))],
            source
          )
        )
      }
      this.traverse(path)
    },
  })
  yield* requires
}
