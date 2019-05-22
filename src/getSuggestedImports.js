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
    result[identifier] = {
      ...undefinedIdentifier,
      suggested: index
        .getSuggestedImports({
          identifier,
          file,
          kind,
          mode: parser.getMode({ code, file }),
        })
        .map(suggested => ({
          ...suggested,
          ast: suggested.code.startsWith('import')
            ? parser.importDeclaration(suggested.code)
            : parser.requireDeclaration(suggested.code),
        })),
    }
  }
  return result
}
