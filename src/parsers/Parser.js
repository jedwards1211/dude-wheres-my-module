// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
  Kind,
} from '../ASTTypes'

export interface Parser {
  parse({ code: string, file?: string }): Promise<
    Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  >;
  importDeclaration(code: string): ImportDeclaration;
  getUndefinedIdentifiers({
    code: string,
    file?: string,
  }): Array<UndefinedIdentifier>;
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
  kind?: Kind,
}
