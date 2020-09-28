import { SuggestResult as BaseResult } from './SuggestedImportIndex'

import { ImportDeclaration, Kind } from './ASTTypes'

export type Location = {
  line: number
  column: number
}

export type UndefinedIdentifier = {
  identifier: string
  start: Location
  end: Location
  context: string
  kind?: Kind
}

export type SuggestedImportResult = BaseResult & {
  ast: ImportDeclaration
}

export type SuggestedImportsResult = {
  [identifier: string]: UndefinedIdentifier & {
    suggested: Array<SuggestedImportResult>
  }
}
