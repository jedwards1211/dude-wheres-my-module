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

export opaque type IdentifierName = string | typeof NAMESPACE

/**
 * Represents a namespace import, e.g. import * as foo from 'foo'.
 */
export const NAMESPACE = Symbol('Namespace')

type ExportInfo = $ReadOnly<{
  /**
   * The file that the identifier is exported from.
   */
  file: string,
  /**
   * The identifier that is exported.
   */
  identifier: IdentifierName,
  /**
   * The kind of export (value or type).
   */
  kind: Kind | 'both',
}>

function addExport(
  exports: Map<any, ExportInfo>,
  key: any,
  exportInfo: ExportInfo
) {
  const { kind } = exportInfo
  const existing = exports.get(key)
  if (!existing) {
    exports.set(key, exportInfo)
  } else if (
    kind &&
    existing.kind &&
    existing.kind !== kind &&
    existing.kind !== 'both'
  ) {
    exports.set(key, { ...exportInfo, kind: 'both' })
  }
}

export class ModuleInfo {
  file: string
  /**
   * Identifiers that this module imports.
   */
  ownImports: Map<IdentifierName, ExportInfo> = new Map()
  /**
   * Identifiers that this module imports, indexed by the name of the module
   * they are imported from.
   */
  ownImportsByModule: Map<string, Map<IdentifierName, ExportInfo>> = new Map()
  /**
   * Names of modules that import from this module.
   */
  importingModules: Map<string, Set<IdentifierName>> = new Map()
  /**
   * Names of modules that import from this module, indexed by the name of the
   * identifier they import.
   */
  importingModulesByIdentifier: Map<IdentifierName, Set<string>> = new Map()
  /**
   * Identifiers that this module exports.
   */
  exports: Map<IdentifierName, ExportInfo> = new Map()

  constructor(file: string) {
    this.file = file
  }

  isDangling(): boolean {
    return (
      !this.ownImports.size && !this.importingModules.size && !this.exports.size
    )
  }

  addOwnImport(local: string, exportInfo: ExportInfo) {
    const { file } = exportInfo
    this.ownImports.set(local, exportInfo)
    let ownImportsByModule = this.ownImportsByModule.get(file)
    if (!ownImportsByModule) {
      ownImportsByModule = new Map()
      this.ownImportsByModule.set(file, ownImportsByModule)
    }
    ownImportsByModule.set(local, exportInfo)
  }

  addImportingModule(file: string, identifier: IdentifierName) {
    let idSet = this.importingModules.get(file)
    if (!idSet) {
      idSet = new Set()
      this.importingModules.set(file, idSet)
    }
    idSet.add(identifier)

    let moduleSet = this.importingModulesByIdentifier.get(identifier)
    if (!moduleSet) {
      moduleSet = new Set()
      this.importingModulesByIdentifier.set(identifier, moduleSet)
    }
    moduleSet.add(file)
  }

  addExport(exportInfo: ExportInfo) {
    addExport(this.exports, exportInfo.identifier, exportInfo)
  }

  numImportingModules(identifier: string): number {
    const modules = this.importingModulesByIdentifier.get(identifier)
    return modules ? modules.size : 0
  }

  isPreferred(identifier: string): boolean {
    const modules = this.importingModulesByIdentifier.get(identifier)
    if (!modules) return false
    for (let m of modules) {
      if (isConfigFile(m)) return true
    }
    return false
  }
}

type Options = {|
  projectRoot: string,
|}

export type ExportsQuery = {
  identifier: string,
  kind?: ?Kind,
}
export type SuggestedImportsQuery = ExportsQuery & {
  file: string,
  mode?: 'import' | 'require',
}
export type SuggestedImportResult = {
  code: string,
}

export default class ModuleIndex {
  projectRoot: string
  nodeModulesDir: string
  modules: Map<string, ModuleInfo> = new Map()
  /**
   * Identifier name -> file that has an export with that name ->
   * info about the export
   */
  identifiers: Map<IdentifierName, Map<string, ExportInfo>> = new Map()

  constructor({ projectRoot }: Options) {
    this.projectRoot = projectRoot
    this.nodeModulesDir = path.resolve(projectRoot, 'node_modules')
  }

  getModule(file: string): ModuleInfo {
    let info = this.modules.get(file)
    if (!info) {
      info = new ModuleInfo(file)
      this.modules.set(file, info)
    }
    return info
  }

  addExport(local: string, exportInfo: ExportInfo) {
    const { file } = exportInfo
    const moduleInfo = this.getModule(file)
    moduleInfo.addExport(exportInfo)

    const identifier =
      exportInfo.identifier === 'default'
        ? path.basename(file).replace(/\.[^/]+$/, '')
        : exportInfo.identifier

    let moduleMap = this.identifiers.get(identifier)
    if (!moduleMap) {
      moduleMap = new Map()
      this.identifiers.set(identifier, moduleMap)
    }
    addExport(moduleMap, file, exportInfo)

    if (local === exportInfo.identifier || local === identifier) return

    moduleMap = this.identifiers.get(local)
    if (!moduleMap) {
      moduleMap = new Map()
      this.identifiers.set(local, moduleMap)
    }
    addExport(moduleMap, file, exportInfo)
  }

  getExports({ identifier, kind }: ExportsQuery): Array<ExportInfo> {
    const moduleMap = this.identifiers.get(identifier)
    if (!moduleMap) return []
    let result = [...moduleMap.values()].sort(
      (a: ExportInfo, b: ExportInfo) => {
        const aModule = this.getModule(a.file)
        const bModule = this.getModule(b.file)
        const aPreferred = aModule.isPreferred(identifier)
        const bPreferred = bModule.isPreferred(identifier)
        if (aPreferred && !bPreferred) return -1
        if (!aPreferred && bPreferred) return 1

        const numImportsDiff =
          bModule.numImportingModules(identifier) -
          aModule.numImportingModules(identifier)
        if (numImportsDiff) return numImportsDiff

        const aNative = !path.isAbsolute(a.file)
        const bNative = !path.isAbsolute(b.file)
        const aNodeModules = a.file.startsWith(this.nodeModulesDir)
        const bNodeModules = b.file.startsWith(this.nodeModulesDir)
        const aLocal = !aNative && !aNodeModules
        const bLocal = !bNative && !bNodeModules
        if (aLocal && !bLocal) return -1
        if (!aLocal && bLocal) return 1
        if (aNodeModules && !bNodeModules) return -1
        if (!aNodeModules && bNodeModules) return 1
        if (aNative && !bNative) return -1
        if (!aNative && bNative) return 1
        if (a.file < b.file) return -1
        if (a.file > b.file) return 1
        return 0
      }
    )
    if (kind) result = result.filter(e => e.kind === kind || e.kind === 'both')
    return result
  }

  getSuggestedImports({
    file,
    mode,
    ...query
  }: SuggestedImportsQuery): Array<SuggestedImportResult> {
    const { identifier } = query
    return this.getExports(query).map((exportInfo: ExportInfo) => {
      let request = exportInfo.file.replace(/(\/index)?\.[^/]+$/, '')
      if (request.startsWith(this.nodeModulesDir)) {
        request = path.relative(this.nodeModulesDir, request)
        const match = /^(@[^/]+\/)?[^/]+/.exec(request)
        const pkg = match && match[0]
        try {
          if (
            pkg &&
            // $FlowFixMe
            resolve.sync(pkg, {
              basedir: this.projectRoot,
            }) === exportInfo.file
          ) {
            request = pkg
          }
        } catch (error) {
          // ignore; maybe a nonexistent import we want to suggest anyway
        }
      } else if (path.isAbsolute(exportInfo.file)) {
        request = path.relative(path.dirname(file), request)
        if (!request.startsWith('.')) request = `./${request}`
      }
      const kind =
        (exportInfo.kind === 'both' ? query.kind : exportInfo.kind) || 'value'
      switch (exportInfo.identifier) {
        case NAMESPACE:
          if (kind === 'value' && mode === 'require') {
            return {
              code: `const ${identifier} = require("${request}")`,
            }
          }
          return {
            code: `import ${
              kind === 'type' ? 'type ' : ''
            }* as ${identifier} from "${request}"`,
          }
        case 'default':
          if (kind === 'value' && mode === 'require') {
            return {
              code: `const ${identifier} = require("${request}")`,
            }
          }
          return {
            code: `import ${
              kind === 'type' ? 'type ' : ''
            }${identifier} from "${request}"`,
          }
        default:
          if (kind === 'value' && mode === 'require') {
            return {
              code: `const {${String(exportInfo.identifier)}${
                identifier === exportInfo.identifier ? '' : ` as ${identifier}`
              }} = require("${request}")`,
            }
          }
          return {
            code: `import { ${kind === 'type' ? 'type ' : ''}${String(
              exportInfo.identifier
            )}${
              identifier === exportInfo.identifier ? '' : ` as ${identifier}`
            } } from "${request}"`,
          }
      }
    })
  }

  /**
   * Removes all of the imports and exports declared by the given file from the
   * index.  However, if other modules import from the given file, those imports
   * will remain in the index.
   */
  undeclareModule(file: string) {
    requireAbsolute(file)
    const moduleInfo = this.getModule(file)

    for (let exportInfo of moduleInfo.exports.values()) {
      const moduleMap = this.identifiers.get(exportInfo.identifier)
      if (moduleMap) {
        moduleMap.delete(file)
        if (!moduleMap.size) this.identifiers.delete(exportInfo.identifier)
      }
    }

    for (let [
      sourceFile,
      identifierMap,
    ] of moduleInfo.ownImportsByModule.entries()) {
      const sourceModuleInfo = this.getModule(sourceFile)
      sourceModuleInfo.importingModules.delete(file)
      for (let identifier of identifierMap.keys()) {
        const moduleMap = sourceModuleInfo.importingModulesByIdentifier.get(
          identifier
        )
        if (moduleMap) {
          moduleMap.delete(file)
          if (!moduleMap.size) {
            sourceModuleInfo.importingModulesByIdentifier.delete(identifier)
            const rootModuleMap = this.identifiers.get(identifier)
            if (rootModuleMap) {
              rootModuleMap.delete(sourceFile)
              if (!rootModuleMap.size) {
                this.identifiers.delete(identifier)
              }
            }
          }
        }
      }
      if (sourceModuleInfo.isDangling()) {
        this.modules.delete(sourceFile)
      }
    }

    moduleInfo.exports.clear()
    moduleInfo.ownImports.clear()
    moduleInfo.ownImportsByModule.clear()
    if (moduleInfo.isDangling()) this.modules.delete(file)
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

    const _module = this.getModule(file)

    for (let declaration of declarations) {
      switch (declaration.type) {
        case 'ImportDeclaration': {
          this._addImportDeclaration(_module, declaration)
          break
        }
        case 'ExportNamedDeclaration': {
          this._addExportNamedDeclaration(_module, declaration)
          break
        }
        case 'ExportDefaultDeclaration': {
          this._addExportDefaultDeclaration(_module, declaration)
          break
        }
        case 'ExportAllDeclaration': {
          this._addExportAllDeclaration(_module, declaration)
          break
        }
        case 'DeclareModule': {
          this._addDeclareModule(declaration)
          break
        }
      }
    }
  }

  _addImportDeclaration(_module: ModuleInfo, declaration: ImportDeclaration) {
    const { specifiers, source } = declaration
    let sourceFile
    try {
      // $FlowFixMe
      sourceFile = resolve.sync(source.value, {
        basedir: path.dirname(_module.file),
        extensions,
      })
      if (!path.isAbsolute(sourceFile)) return
    } catch (err) {
      console.error('[dwmm] ERROR:', err.message, `(in file ${_module.file})`) // eslint-disable-line no-console
      sourceFile = path.resolve(
        source.value.startsWith('.')
          ? path.dirname(_module.file)
          : this.nodeModulesDir,
        source.value
      )
    }
    for (let specifier of specifiers) {
      const kind = specifier.importKind || declaration.importKind || 'value'
      let identifier
      switch (specifier.type) {
        case 'ImportSpecifier':
          identifier = specifier.imported.name
          break
        case 'ImportDefaultSpecifier':
          identifier = 'default'
          break
        case 'ImportNamespaceSpecifier':
          identifier = NAMESPACE
          break
        default:
          continue
      }
      const exportInfo: ExportInfo = {
        file: sourceFile,
        identifier,
        kind,
      }

      const localName = (specifier.local || specifier.imported).name

      _module.addOwnImport(localName, exportInfo)

      const importedModule = this.getModule(sourceFile)
      importedModule.addImportingModule(_module.file, identifier)

      this.addExport(localName, exportInfo)
    }
  }
  _addExportNamedDeclaration(
    _module: ModuleInfo,
    exportDeclaration: ExportNamedDeclaration
  ) {
    const { specifiers, declaration } = exportDeclaration
    let kind = exportDeclaration.exportKind || 'value'
    for (let specifier of specifiers) {
      let identifier
      switch (specifier.type) {
        case 'ExportSpecifier':
        case 'ExportDefaultSpecifier':
        case 'ExportNamespaceSpecifier':
          identifier = specifier.exported.name
          break
        default:
          continue
      }
      this.addExport(identifier, {
        file: _module.file,
        identifier,
        kind,
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
        case 'FunctionDeclaration':
        case 'TypeAlias':
        case 'InterfaceDeclaration':
          identifier = declaration.id.name
          break
      }
      if (declaration.type === 'ClassDeclaration') {
        kind = 'both'
      }
      if (identifier) {
        this.addExport(identifier, {
          file: _module.file,
          identifier,
          kind,
        })
      }
    }
  }
  _addExportDefaultDeclaration(
    _module: ModuleInfo,
    exportDeclaration: ExportDefaultDeclaration
  ) {
    const { declaration } = exportDeclaration
    if (declaration) {
      switch (declaration.type) {
        case 'ClassDeclaration':
          this.addExport(declaration.id.name, {
            file: _module.file,
            identifier: 'default',
            kind: 'both',
          })
          break
        case 'FunctionDeclaration':
          this.addExport(declaration.id.name, {
            file: _module.file,
            identifier: 'default',
            kind: 'value',
          })
      }
    }
    this.addExport('default', {
      file: _module.file,
      identifier: 'default',
      kind:
        declaration && declaration.type === 'ClassDeclaration'
          ? 'both'
          : 'value',
    })
  }
  _addExportAllDeclaration(
    _module: ModuleInfo,
    declaration: ExportAllDeclaration
  ) {
    // TODO
  }

  _addDeclareModule(declareModule: DeclareModule) {
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
    const convertedDeclarations: Array<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
      | DeclareModule
    > = []
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

          let convertedExportDeclaration:
            | ExportDefaultDeclaration
            | ExportNamedDeclaration

          if (isDefault) {
            convertedExportDeclaration = {
              type: 'ExportDefaultDeclaration',
              declaration: (convertedDeclaration: any),
              exportKind,
            }
          } else {
            convertedExportDeclaration = {
              type: 'ExportNamedDeclaration',
              declaration: convertedDeclaration,
              exportKind,
              specifiers: [],
              source,
            }
          }
          convertedDeclarations.push(convertedExportDeclaration)
        }
        if (specifiers && specifiers.length) {
          convertedDeclarations.push({
            type: 'ExportNamedDeclaration',
            declaration: null,
            exportKind: 'value',
            specifiers,
            source,
          })
        }
      }
      if (convertedDeclarations.length) {
        this.declareModule(file, convertedDeclarations)
      }
    }
  }
}

function requireAbsolute(file: string) {
  if (!path.isAbsolute(file)) {
    throw new Error(`file must be absolute, got ${file}`)
  }
}
