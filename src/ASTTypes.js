// @flow

export type Kind = 'value' | 'type'

export type StringLiteral = {
  type: 'StringLiteral',
  value: string,
}

export type Identifier = {
  type: 'Identifier',
  name: string,
}

export type ImportSpecifier = {
  type: 'ImportSpecifier',
  imported: Identifier,
  importKind?: ?Kind,
  local: Identifier,
}

export type ImportDefaultSpecifier = {
  type: 'ImportDefaultSpecifier',
  local: Identifier,
  importKind?: ?Kind,
}

export type ImportNamespaceSpecifier = {
  type: 'ImportNamespaceSpecifier',
  local: Identifier,
  importKind?: ?Kind,
}

export type ImportDeclaration = {
  type: 'ImportDeclaration',
  importKind?: ?Kind,
  source: StringLiteral,
  specifiers: Array<
    ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier
  >,
}

export type ExportSpecifier = {
  type: 'ExportSpecifier',
  local: Identifier,
  exported: Identifier,
}

export type ExportNamespaceSpecifier = {
  type: 'ExportNamespaceSpecifier',
  exported: Identifier,
}

export type ExportDefaultSpecifier = {
  type: 'ExportDefaultSpecifier',
  exported: Identifier,
}

export type ExportNamedDeclaration = {
  type: 'ExportNamedDeclaration',
  specifiers: Array<
    ExportSpecifier | ExportDefaultSpecifier | ExportNamespaceSpecifier
  >,
  source: ?StringLiteral,
  declaration: ?(
    | Identifier
    | VariableDeclaration
    | ClassDeclaration
    | FunctionDeclaration
    | TypeAlias
    | InterfaceDeclaration
  ),
  exportKind?: ?Kind,
}

export type ExportDefaultDeclaration = {
  type: 'ExportDefaultDeclaration',
  declaration: Identifier | ClassDeclaration | FunctionDeclaration,
  exportKind?: ?Kind,
}

export type ExportAllDeclaration = {
  type: 'ExportAllDeclaration',
  source: StringLiteral,
  exportKind?: ?Kind,
}

export type VariableDeclaration = {
  type: 'VariableDeclaration',
  declarations: Array<VariableDeclarator>,
}

export type DeclareVariable = {
  type: 'DeclareVariable',
  id: Identifier,
}

export type VariableDeclarator = {
  type: 'VariableDeclarator',
  id: Identifier,
}

export type TypeAlias = {
  type: 'TypeAlias',
  id: Identifier,
}

export type InterfaceDeclaration = {
  type: 'InterfaceDeclaration',
  id: Identifier,
}

export type ClassDeclaration = {
  type: 'ClassDeclaration',
  id: Identifier,
}

export type DeclareClass = {
  type: 'DeclareClass',
  id: Identifier,
}

export type FunctionDeclaration = {
  type: 'FunctionDeclaration',
  id: Identifier,
}

export type DeclareFunction = {
  type: 'DeclareFunction',
  id: Identifier,
}

export type Literal = {
  type: 'Literal',
  value: any,
}

export type DeclareModule = {
  type: 'DeclareModule',
  id: Literal,
  body: DeclareModuleBlockStatement,
}

export type DeclareModuleBlockStatement = {
  type: 'BlockStatement',
  body: Array<DeclareModuleStatement>,
}

export type DeclareModuleStatement = DeclareExportDeclaration | { type: string }

export type DeclareExportDeclaration = {
  type: 'DeclareExportDeclaration',
  default: boolean,
  declaration: ?(
    | DeclareClass
    | DeclareFunction
    | DeclareVariable
    | InterfaceDeclaration
    | TypeAlias
  ),
  specifiers: Array<
    ExportSpecifier | ExportDefaultSpecifier | ExportNamespaceSpecifier
  >,
  source: ?StringLiteral,
}
