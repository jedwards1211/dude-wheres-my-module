// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
} from '../ASTTypes'

export interface Parser {
  parse(
    {| file: string |} | {| code: string |}
  ): Promise<
    Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  >;
  importDeclaration(code: string): ImportDeclaration;
  getUndefinedIdentifiers(code: string): Array<UndefinedIdentifier>;
}

export type Location = {
  line: number,
  column: number,
}

export type UndefinedIdentifier = {
  identifier: string,
  start: Location,
  end: Location,
  context: string,
}
