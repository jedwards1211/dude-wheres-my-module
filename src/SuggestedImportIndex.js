// @flow

import path from 'path'
import isConfigFile from './isConfigFile'
import console from './console'
import type {
  Kind,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  DeclareModule,
  DeclareExportDeclaration,
  ClassDeclaration,
  FunctionDeclaration,
  VariableDeclaration,
  InterfaceDeclaration,
  TypeAlias,
} from './ASTTypes'
import extensions from './extensions'
import resolve from 'resolve'
import identifierFromFilename from './util/identifierFromFilename'
import lazy from './util/lazy'
import some from './util/some'
import sortBy from 'lodash/sortBy'

export type SuggestOptions = {|
  identifier: string,
  kind?: Kind,
  file?: string,
  mode?: 'import' | 'require',
|}

export type SuggestResult = {| code: string |}

export type SuggestResults = Array<SuggestResult>

opaque type ImportAsIdentifier = string
opaque type SuggestedImportSourceKey = string

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  let value = map.get(key)
  if (!value) map.set(key, (value = create()))
  return value
}

export class SuggestedImportSource {
  /**
   * Whether the export is a value or type
   */
  +kind: 'value' | 'type' | 'both'
  /**
   * The identifier to import
   */
  +imported: string
  /**
   * The local identifier to import as
   */
  +importAs: ImportAsIdentifier
  /**
   * The module to import from
   */
  +from: string
  /**
   * The module this import was found in (nullish if the suggestion is based off the exporting module)
   */
  +importFoundIn: ?string
  +importKey: SuggestedImportKey
  +key: SuggestedImportSourceKey

  constructor(props: {|
    kind: 'value' | 'type' | 'both',
    imported: string,
    importAs: string,
    from: string,
    importFoundIn?: ?string,
  |}) {
    const { kind, imported, importAs, from, importFoundIn } = props
    this.kind = kind
    this.imported = imported
    this.importAs = importAs
    this.from = from
    this.importFoundIn = importFoundIn
    this.importKey = `import { ${imported} as ${importAs} } from ${JSON.stringify(
      from
    )}`
    this.key = `import ${
      kind === 'type' ? 'type ' : ''
    }{ ${imported} as ${importAs} } from ${JSON.stringify(from)} ${
      importFoundIn ? `(in ${importFoundIn})` : ''
    }`
  }
}

opaque type SuggestedImportKey = string

class SuggestedImport {
  /**
   * The identifier to import
   */
  +imported: string
  /**
   * The local identifier to import as
   */
  +importAs: ImportAsIdentifier
  /**
   * The module to import from
   */
  +from: string
  /**
   * The unique key for map entries
   */
  +key: SuggestedImportKey
  /**
   * The sources this suggestion is based off of
   */
  +sources: Map<SuggestedImportSourceKey, SuggestedImportSource> = new Map()

  constructor({
    imported,
    importAs,
    from,
    key,
  }: $ReadOnly<{
    imported: string,
    importAs: string,
    from: string,
    key: SuggestedImportKey,
  }>) {
    this.imported = imported
    this.importAs = importAs
    this.from = from
    this.key = key
  }

  _clearLazy() {
    this._getKind.clear()
    this._getIsPreferred.clear()
  }

  add(source: SuggestedImportSource) {
    this._clearLazy()
    this.sources.set(source.key, source)
  }

  delete(source: SuggestedImportSource) {
    this._clearLazy()
    this.sources.delete(source.key)
  }

  get numSources(): number {
    return this.sources.size
  }

  _getKind = lazy(
    (): 'value' | 'type' | 'both' => {
      const hasValue = some(
        this.sources.values(),
        ({ kind }) => kind === 'both' || kind === 'value'
      )
      const hasType = some(
        this.sources.values(),
        ({ kind }) => kind === 'both' || kind === 'type'
      )
      return hasValue && hasType ? 'both' : hasType ? 'type' : 'value'
    }
  )

  get kind(): 'value' | 'type' | 'both' {
    return this._getKind()
  }

  _getIsPreferred = lazy(() =>
    some(this.sources.values(), ({ importFoundIn }) =>
      importFoundIn ? isConfigFile(importFoundIn) : false
    )
  )

  get isPreferred(): boolean {
    return this._getIsPreferred()
  }
}

class SuggestionsForIdentifier {
  +importAs: ImportAsIdentifier
  +suggestions: Map<SuggestedImportKey, SuggestedImport> = new Map()

  constructor({ importAs }: {| importAs: ImportAsIdentifier |}) {
    this.importAs = importAs
  }

  add(source: SuggestedImportSource) {
    getOrCreate(
      this.suggestions,
      source.importKey,
      () => new SuggestedImport(source)
    ).add(source)
  }
  delete(source: SuggestedImportSource) {
    const suggestion = this.suggestions.get(source.importKey)
    if (suggestion) {
      suggestion.delete(source)
      if (!suggestion.numSources) {
        this.suggestions.delete(source.importKey)
      }
    }
  }

  get size(): number {
    return this.suggestions.size
  }
}

class Module {
  +file: string
  +sources: Array<SuggestedImportSource>

  constructor({
    file,
    sources,
  }: {|
    file: string,
    sources: Array<SuggestedImportSource>,
  |}) {
    this.file = file
    this.sources = sources
  }
}

function requireAbsolute(file: string) {
  if (!path.isAbsolute(file)) {
    throw new Error(`file must be absolute, got ${file}`)
  }
}

export default class SuggestedImportIndex {
  +projectRoot: string
  +nodeModulesDir: string
  +suggestions: Map<ImportAsIdentifier, SuggestionsForIdentifier> = new Map()
  modules: Map<string, Module> = new Map()

  constructor({ projectRoot }: {| projectRoot: string |}) {
    this.projectRoot = projectRoot
    this.nodeModulesDir = path.resolve(projectRoot, 'node_modules')
  }

  addSuggestion(source: SuggestedImportSource) {
    const { importAs } = source
    getOrCreate(
      this.suggestions,
      importAs,
      () => new SuggestionsForIdentifier({ importAs })
    ).add(source)
  }

  deleteSuggestion(source: SuggestedImportSource) {
    const suggestions = this.suggestions.get(source.importAs)
    if (suggestions) {
      suggestions.delete(source)
      if (!suggestions.size) {
        this.suggestions.delete(source.importAs)
      }
    }
  }

  _resolveFrom(importingFile: ?string, from: string): string {
    let result = from.replace(/(\/index)?\.[^/]+$/, '')
    if (result.startsWith(this.nodeModulesDir)) {
      result = path.relative(this.nodeModulesDir, result)
      const match = /^(@[^/]+\/)?[^/]+/.exec(result)
      const pkg = match && match[0]
      try {
        if (
          pkg &&
          // $FlowFixMe
          resolve.sync(pkg, {
            basedir: this.projectRoot,
          }) === from
        ) {
          result = pkg
        }
      } catch (error) {
        // ignore; maybe a nonexistent import we want to suggest anyway
      }
    } else if (path.isAbsolute(result) && importingFile) {
      result = path.relative(path.dirname(importingFile), result)
      if (!result.startsWith('.')) result = `./${result}`
    }
    return result
  }

  suggest(options: SuggestOptions): SuggestResults {
    const { mode } = options
    const forIdentifier = this.suggestions.get(options.identifier)
    if (!forIdentifier) return []
    return sortBy(
      [...forIdentifier.suggestions.values()]
        .filter(
          ({ kind }) =>
            kind === 'both' || options.kind == null || kind === options.kind
        )
        .map(({ kind, imported, importAs, from, isPreferred, numSources }) => ({
          kind,
          imported,
          importAs,
          from: this._resolveFrom(options.file, from),
          isPreferred,
          numSources,
          isNative: !path.isAbsolute(from),
          isNodeModules: from.startsWith(this.nodeModulesDir),
        })),
      [
        s => (s.isPreferred ? -1 : 1),
        s => (!s.isNative && !s.isNodeModules ? s.from.length : Infinity),
        s => (!s.isNodeModules ? -1 : 1),
        s => (!s.isNative ? -1 : 1),
        s => -s.numSources,
        s => s.from,
      ]
    ).map(
      ({
        kind: suggestedKind,
        imported,
        importAs,
        from,
      }: {
        kind: 'type' | 'value' | 'both',
        imported: string,
        importAs: string,
        from: string,
      }): SuggestResult => {
        const kind =
          (suggestedKind === 'both' ? options.kind : suggestedKind) || 'value'
        switch (imported) {
          case '*':
            return kind === 'value' && mode === 'require'
              ? { code: `const ${importAs} = require("${from}")` }
              : {
                  code: `import ${
                    kind === 'type' ? 'type ' : ''
                  }* as ${importAs} from "${from}"`,
                }
          case 'default':
            return kind === 'value' && mode === 'require'
              ? { code: `const ${importAs} = require("${from}")` }
              : {
                  code: `import ${
                    kind === 'type' ? 'type ' : ''
                  }${importAs} from "${from}"`,
                }
          default:
            return kind === 'value' && mode === 'require'
              ? {
                  code: `const {${
                    imported === importAs
                      ? imported
                      : `${imported}: ${importAs}`
                  }} = require("${from}")`,
                }
              : {
                  code: `import { ${kind === 'type' ? 'type ' : ''}${
                    imported === importAs
                      ? imported
                      : `${imported} as ${importAs}`
                  } } from "${from}"`,
                }
        }
      }
    )
  }

  undeclareModule(file: string) {
    const module = this.modules.get(file)
    if (!module) return
    for (const source of module.sources) this.deleteSuggestion(source)
    this.modules.delete(file)
  }

  declareModule(
    file: string,
    declarations: Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  ) {
    requireAbsolute(file)
    this.undeclareModule(file)
    const sources = [...this._convertDeclarations(file, declarations)]
    const module = new Module({ file, sources })
    this.modules.set(file, module)
    for (const source of sources) this.addSuggestion(source)
  }

  *_convertDeclarations(
    file: string,
    declarations: Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    >
  ): Iterable<SuggestedImportSource> {
    for (const declaration of declarations) {
      yield* this._convertDeclaration(file, declaration)
    }
  }

  *_convertDeclaration(
    file: string,
    declaration:
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
  ): Iterable<SuggestedImportSource> {
    switch (declaration.type) {
      case 'ImportDeclaration': {
        yield* this._convertImportDeclaration(file, declaration)
        break
      }
      case 'ExportNamedDeclaration': {
        yield* this._convertExportNamedDeclaration(file, declaration)
        break
      }
      case 'ExportDefaultDeclaration': {
        yield* this._convertExportDefaultDeclaration(file, declaration)
        break
      }
      case 'ExportAllDeclaration': {
        yield* this._convertExportAllDeclaration(file, declaration)
        break
      }
      case 'DeclareModule': {
        yield* this._convertDeclareModule(declaration)
        break
      }
    }
  }

  *_convertImportDeclaration(
    file: string,
    declaration: ImportDeclaration
  ): Iterable<SuggestedImportSource> {
    const { specifiers, source } = declaration
    let sourceFile
    try {
      // $FlowFixMe
      sourceFile = resolve.sync(source.value, {
        basedir: path.dirname(file),
        extensions,
      })
      if (!path.isAbsolute(sourceFile)) return
    } catch (err) {
      console.error('[dwmm] ERROR:', err.message, `(in file ${file})`) // eslint-disable-line no-console
      sourceFile = path.resolve(
        source.value.startsWith('.') ? path.dirname(file) : this.nodeModulesDir,
        source.value
      )
    }
    for (let specifier of specifiers) {
      const kind = specifier.importKind || declaration.importKind || 'value'
      let imported
      switch (specifier.type) {
        case 'ImportSpecifier':
          imported = specifier.imported.name
          if (specifier.local.name !== imported) {
            yield new SuggestedImportSource({
              kind: kind === 'typeof' ? 'value' : kind,
              imported,
              importAs: imported,
              from: sourceFile,
              importFoundIn: file,
            })
          }
          break
        case 'ImportDefaultSpecifier':
          imported = 'default'
          break
        case 'ImportNamespaceSpecifier':
          imported = '*'
          break
        default:
          continue
      }
      yield new SuggestedImportSource({
        kind: kind === 'typeof' ? 'value' : kind,
        imported,
        importAs: (specifier.local || specifier.imported).name,
        from: sourceFile,
        importFoundIn: file,
      })
    }
  }

  *_convertExportNamedDeclaration(
    file: string,
    exportDeclaration: ExportNamedDeclaration
  ): Iterable<SuggestedImportSource> {
    const { specifiers, declaration } = exportDeclaration
    let kind = exportDeclaration.exportKind || 'value'
    for (let specifier of specifiers) {
      yield new SuggestedImportSource({
        kind,
        imported: specifier.exported.name,
        importAs: specifier.exported.name,
        from: file,
      })
    }
    if (declaration) {
      let identifier
      switch (declaration.type) {
        case 'Identifier':
          identifier = declaration.name
          break
        case 'VariableDeclaration': {
          const {
            declarations: [declarator],
          } = declaration
          if (declarator) identifier = declarator.id.name
          break
        }
        case 'ClassDeclaration':
          kind = 'both'
        // eslint-disable-next-line no-fallthrough
        case 'FunctionDeclaration':
        case 'TypeAlias':
        case 'InterfaceDeclaration':
          identifier = declaration.id.name
          break
      }
      if (identifier) {
        yield new SuggestedImportSource({
          kind,
          imported: identifier,
          importAs: identifier,
          from: file,
        })
      }
    }
  }

  *_convertExportDefaultDeclaration(
    file: string,
    exportDeclaration: ExportDefaultDeclaration
  ): Iterable<SuggestedImportSource> {
    const { declaration } = exportDeclaration
    const importAs = identifierFromFilename(file)
    let kind = 'value'
    if (declaration) {
      switch (declaration.type) {
        case 'ClassDeclaration':
          kind = 'both'
        // eslint-disable-next-line no-fallthrough
        case 'FunctionDeclaration':
          if (declaration.id.name !== importAs) {
            yield new SuggestedImportSource({
              kind: 'value',
              imported: 'default',
              importAs: declaration.id.name,
              from: file,
            })
          }
          break
      }
    }
    yield new SuggestedImportSource({
      kind,
      imported: 'default',
      importAs,
      from: file,
    })
  }

  *_convertExportAllDeclaration(
    file: string,
    declaration: ExportAllDeclaration
  ): Iterable<SuggestedImportSource> {
    // TODO
  }

  *_convertDeclareModule(
    declareModule: DeclareModule
  ): Iterable<SuggestedImportSource> {
    let file: string
    try {
      // $FlowFixMe
      file = resolve.sync(declareModule.id.value, {
        basedir: this.projectRoot,
        extensions,
      })
    } catch (error) {
      return
    }
    for (let statement of declareModule.body.body) {
      if (statement.type === 'DeclareExportDeclaration') {
        const {
          declaration,
          specifiers,
          source,
          default: isDefault,
        } = ((statement: any): DeclareExportDeclaration)
        if (declaration) {
          let convertedDeclaration:
            | ClassDeclaration
            | FunctionDeclaration
            | VariableDeclaration
            | InterfaceDeclaration
            | TypeAlias
          switch (declaration.type) {
            case 'DeclareClass': {
              convertedDeclaration = {
                ...(declaration: any),
                type: 'ClassDeclaration',
              }
              break
            }
            case 'DeclareFunction': {
              convertedDeclaration = {
                ...(declaration: any),
                type: 'FunctionDeclaration',
              }
              break
            }
            case 'DeclareVariable': {
              convertedDeclaration = {
                type: 'VariableDeclaration',
                declarations: [
                  {
                    ...(declaration: any),
                    type: 'VariableDeclarator',
                  },
                ],
                kind: 'var',
              }
              break
            }
            case 'InterfaceDeclaration':
            case 'TypeAlias': {
              convertedDeclaration = declaration
              break
            }
          }
          const exportKind: Kind =
            declaration.type === 'InterfaceDeclaration' ||
            declaration.type === 'TypeAlias'
              ? 'type'
              : 'value'

          if (isDefault) {
            yield* this._convertExportDefaultDeclaration(file, {
              type: 'ExportDefaultDeclaration',
              declaration: (convertedDeclaration: any),
              exportKind,
            })
          } else {
            yield* this._convertExportNamedDeclaration(file, {
              type: 'ExportNamedDeclaration',
              declaration: convertedDeclaration,
              exportKind,
              specifiers: [],
              source,
            })
          }
        }
        if (specifiers && specifiers.length) {
          yield* this._convertExportNamedDeclaration(file, {
            type: 'ExportNamedDeclaration',
            declaration: null,
            exportKind: 'value',
            specifiers,
            source,
          })
        }
      }
    }
  }
}
