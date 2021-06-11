/**
 * @flow
 * @prettier
 */

import type { Parser, UndefinedIdentifier } from './parsers/Parser'
import type ModuleIndex, {
  SuggestResult as BaseResult,
} from './SuggestedImportIndex'

import { type ImportDeclaration } from './ASTTypes'

export type SuggestedImportResult = BaseResult & {
  ast: ImportDeclaration,
}

export type SuggestedImportsQuery = {
  code: string,
  file: string,
  parser: Parser,
  index: ModuleIndex,
}

export type SuggestedImportsResult = {
  [identifier: string]: UndefinedIdentifier & {
    suggested: Array<SuggestedImportResult>,
  },
}

export default function getSuggestedImports({
  code,
  file,
  parser,
  index,
}: $ReadOnly<SuggestedImportsQuery>): SuggestedImportsResult {
  const undefinedIdentifiers = parser.getUndefinedIdentifiers({ code, file })

  const result = {}
  for (let undefinedIdentifier of undefinedIdentifiers) {
    const { identifier, kind } = undefinedIdentifier
    const suggested = index
      .suggest({
        identifier,
        file,
        kind,
        mode: parser.getMode({ code, file }),
      })
      .map((suggested) => ({
        ...suggested,
        ast: suggested.code.startsWith('import')
          ? parser.importDeclaration(suggested.code)
          : parser.requireDeclaration(suggested.code),
      }))
    if (result[identifier]) {
      suggested.forEach((s) => result[identifier].suggested.push(s))
    } else {
      result[identifier] = {
        ...undefinedIdentifier,
        suggested,
      }
    }
  }
  return result
}
