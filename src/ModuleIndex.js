// @flow

import path from 'path'
import sortBy from 'lodash/sortBy'

import type {
  Kind,
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
} from './ASTTypes'

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
  kind: Kind,
  /**
   * If this is specified asepreferred in user configuration files,
   * the value of this field should be the index in the list of preferred
   * imports.
   */
  preferred?: number,
}>

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
    this.exports.set(exportInfo.identifier, exportInfo)
  }
}

type Options = {
  projectRoot: string,
}

export type ExportsQuery = {
  identifier: string,
  kind?: ?Kind,
}
export type SuggestedImportsQuery = ExportsQuery & {
  file: string,
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
    requireAbsolute(file)
    let info = this.modules.get(file)
    if (!info) {
      info = new ModuleInfo(file)
      this.modules.set(file, info)
    }
    return info
  }

  addExport(exportInfo: ExportInfo) {
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
    moduleMap.set(file, exportInfo)
  }

  getExports({ identifier, kind }: ExportsQuery): Array<ExportInfo> {
    const moduleMap = this.identifiers.get(identifier) || []
    let result = sortBy([...moduleMap.values()], ({ file }: ExportInfo) => {
      const moduleInfo = this.getModule(file)
      const importingModules = moduleInfo.importingModulesByIdentifier.get(
        identifier
      )
      return importingModules ? -importingModules.size : 0
    })
    if (kind) result = result.filter(e => e.kind === kind)
    return result
  }

  getSuggestedImports({
    file,
    ...query
  }: SuggestedImportsQuery): Array<string> {
    const { identifier } = query
    return this.getExports(query).map((exportInfo: ExportInfo) => {
      let request = exportInfo.file.replace(/(\/index)?\.[^/]+$/, '')
      if (request.startsWith(this.nodeModulesDir)) {
        request = path.relative(this.nodeModulesDir, request)
      } else {
        request = path.relative(path.dirname(file), request)
      }
      switch (exportInfo.identifier) {
        case NAMESPACE:
          return `import * as ${identifier} from "${request}"`
        case 'default':
          return `import ${identifier} from "${request}"`
        default:
          return `import { ${exportInfo.kind === 'type' ? 'type ' : ''}${String(
            exportInfo.identifier
          )}${
            identifier === exportInfo.identifier ? '' : ` as ${identifier}`
          } } from "${request}"`
      }
    })
  }

  /**
   * Removes all of the imports and exports declared by the given file from the
   * index.  However, if other modules import from the given file, those imports
   * will remain in the index.
   */
  undeclareModule(file: string) {
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
    >
  ) {
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
      }
    }
  }

  _addImportDeclaration(_module: ModuleInfo, declaration: ImportDeclaration) {
    const { specifiers, source } = declaration
    let sourceFile
    try {
      // $FlowFixMe
      sourceFile = require.resolve(source.value, {
        paths: [path.dirname(_module.file)],
      })
      if (!path.isAbsolute(sourceFile)) return
    } catch (err) {
      console.error('[dwmm] ERROR:', err.message, `(in file ${_module.file})`) // eslint-disable-line no-console
      return
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
      _module.addOwnImport(specifier.local.name, exportInfo)

      const importedModule = this.getModule(sourceFile)
      importedModule.addImportingModule(_module.file, identifier)

      this.addExport(exportInfo)
    }
  }
  _addExportNamedDeclaration(
    _module: ModuleInfo,
    exportDeclaration: ExportNamedDeclaration
  ) {
    const { specifiers, declaration } = exportDeclaration
    const kind = exportDeclaration.exportKind || 'value'
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
      this.addExport({
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
      if (identifier) {
        this.addExport({
          file: _module.file,
          identifier,
          kind,
        })
      }
    }
  }
  _addExportDefaultDeclaration(
    _module: ModuleInfo,
    declaration: ExportDefaultDeclaration
  ) {
    this.addExport({
      file: _module.file,
      identifier: 'default',
      kind: 'value',
    })
  }
  _addExportAllDeclaration(
    _module: ModuleInfo,
    declaration: ExportAllDeclaration
  ) {
    // TODO
  }
}

function requireAbsolute(file: string) {
  if (!path.isAbsolute(file)) {
    throw new Error(`file must be absolute, got ${file}`)
  }
}