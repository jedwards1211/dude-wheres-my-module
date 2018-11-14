/**
 * @flow
 * @prettier
 */

import type { Parser, UndefinedIdentifier } from './parsers/Parser'
import type ModuleIndex, { SuggestedImportResult } from './ModuleIndex'

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
      suggested: index.getSuggestedImports({ identifier, file }),
    }
  }
  return result
}
