// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
  Kind,
  VariableDeclaration,
} from '../ASTTypes'

export interface Parser {
  getMode({ code: string, file?: string }): 'import' | 'require';
  parse({ code: string, file?: string }): AsyncIterable<
    | ImportDeclaration
    | ExportNamedDeclaration
    | ExportDefaultDeclaration
    | ExportAllDeclaration
    | DeclareModule
  >;
  importDeclaration(code: string): ImportDeclaration;
  requireDeclaration(code: string): VariableDeclaration;
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
