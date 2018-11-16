/**
 * @flow
 * @prettier
 */

import type { Parser, UndefinedIdentifier } from './parsers/Parser'
import type ModuleIndex, {
  SuggestedImportResult as BaseResult,
} from './ModuleIndex'

import { type ImportDeclaration } from './ASTTypes'

export type SuggestedImportResult = BaseResult & {
  ast: ImportDeclaration,
}

export default function getSuggestedImports({
  code,
  file,
  parser,
  index,
}: $ReadOnly<{
  code: string,
  file: string,
  parser: Parser,
  index: ModuleIndex,
}>): {
  [identifier: string]: UndefinedIdentifier & {
    suggested: Array<SuggestedImportResult>,
  },
} {
  const undefinedIdentifiers = parser.getUndefinedIdentifiers(code)

  const result = {}
  for (let undefinedIdentifier of undefinedIdentifiers) {
    const { identifier } = undefinedIdentifier
    result[identifier] = {
      ...undefinedIdentifier,
      suggested: index
        .getSuggestedImports({ identifier, file })
        .map(suggested => ({
          ...suggested,
          ast: parser.importDeclaration(suggested.code),
        })),
    }
  }
  return result
}
