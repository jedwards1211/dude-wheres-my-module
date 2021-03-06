// @flow

import path from 'path'
import { spawn } from 'child_process'
import type { Parser } from './parsers/Parser'
import chokidar from 'chokidar'
import SuggestedImportIndex, {
  SuggestedImportSource,
} from './SuggestedImportIndex'
import FlowParser from './parsers/flow'
import loadIgnorePatterns from './loadIgnorePatterns'
import EventEmitter from '@jcoreio/typed-event-emitter'
import emitted from 'p-event'
import throttle from 'lodash/throttle'
import isConfigFile from './isConfigFile'
import console from './console'
import fs from 'fs-extra'
import { type Stats } from 'fs'
import extensions from './extensions'
import createIgnore from 'ignore'

export type Progress = { completed: number, total: number }

type Events = {
  ready: [],
  progress: [Progress],
  processFileError: [Error],
  error: [Error],
}

export default class WatchingIndexer extends EventEmitter<Events> {
  projectRoot: string
  parser: Parser
  index: SuggestedImportIndex
  watcher: any
  gotReady: boolean = false
  allFiles: Set<string> = new Set()
  pendingFiles: Set<string> = new Set()

  constructor({
    projectRoot,
    parser,
    index,
  }: {
    projectRoot: string,
    parser: Parser,
    index: SuggestedImportIndex,
  }) {
    super()
    this.projectRoot = projectRoot
    this.parser = parser
    this.index = index
  }

  isReady(): boolean {
    return this.gotReady && !this.pendingFiles.size
  }

  getProgress(): Progress {
    return {
      completed: this.allFiles.size - this.pendingFiles.size,
      total: this.allFiles.size,
    }
  }

  async waitUntilReady(): Promise<void> {
    if (this.isReady()) return
    await emitted(this, 'ready')
  }

  deletePendingFile(file: string) {
    this.pendingFiles.delete(file)
    this.emitProgress()
    if (this.isReady()) this.emit('ready')
  }

  async processFile(file: string): Promise<void> {
    this.emitProgress()
    this.pendingFiles.add(file)
    try {
      if (isConfigFile(file)) {
        delete require.cache[file]
        const configure = require(file)
        const { preferredImports } = (await configure()) || {}
        if (preferredImports) {
          await Promise.all(
            (Array.isArray(preferredImports)
              ? preferredImports
              : [preferredImports]
            ).map(async (code: string) => {
              try {
                await this.index.declareModule(
                  file,
                  await this.parser.parse({ code, file })
                )
              } catch (error) {
                console.error('[dwmm] error:', error.stack)
              }
            })
          )
        }
      } else {
        const code = await fs.readFile(file, 'utf8')
        await this.index.declareModule(file, this.parser.parse({ code, file }))
      }
    } catch (error) {
      console.error('[dwmm] error:', error.stack)
      this.emit('processFileError', error)
      this.allFiles.delete(file)
    } finally {
      this.deletePendingFile(file)
    }
  }

  async loadNatives(): Promise<void> {
    const chunks = []
    const child = spawn('node', [require.resolve('./printNatives')], {
      cwd: this.projectRoot,
      stdio: 'pipe',
    })
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    await new Promise((resolve: any, reject: any) => {
      const withCleanup =
        (callback) =>
        (...args: any) => {
          child.removeListener('close', resolve)
          child.removeListener('error', reject)
          callback(...args)
        }
      child.on('close', withCleanup(resolve))
      child.on('error', withCleanup(reject))
    })
    const natives = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const { index } = this
    for (const key in natives) {
      index.addSuggestion(
        new SuggestedImportSource({
          kind: 'value',
          imported: 'default',
          importAs: key,
          from: key,
        })
      )
      for (const identifier of natives[key]) {
        index.addSuggestion(
          new SuggestedImportSource({
            kind: 'value',
            imported: identifier,
            importAs: identifier,
            from: key,
          })
        )
      }
    }
  }

  async start(): Promise<void> {
    const { projectRoot } = this

    if (this.watcher) return
    const ignorePatterns = await loadIgnorePatterns({ projectRoot })
    ignorePatterns.forEach((file) => console.error('[dwmm] ignoring:', file)) // eslint-disable-line no-console
    const ignore = createIgnore().add(ignorePatterns)
    const globs = [
      ...extensions.map((ext) => `**/*${ext}`),
      '**/.dude-wheres-my-module.js',
    ]
    this.watcher = chokidar.watch(globs, {
      ignored: [
        (file: string, stats?: Stats): boolean => {
          if (!stats) return false
          const relative = path.relative(projectRoot, file)
          const result =
            relative === '.' || relative === ''
              ? false
              : !isConfigFile(file) &&
                (/(^|[/\\])\../.test(file) ||
                  ignore.ignores(relative + (stats.isDirectory() ? '/' : '')))
          return result
        },
      ],
      cwd: this.projectRoot,
    })
    this.watcher.on('error', (err: Error) => {
      console.error('[dwmm] ERROR:', err.stack) // eslint-disable-line no-console
    })
    this.watcher.on('ready', () => {
      this.gotReady = true
      for (const file of this.allFiles) this.processFile(file)
      if (this.isReady()) this.emit('ready')
    })
    this.watcher.on('add', (file: string) => {
      console.error('[dwmm] added:', file) // eslint-disable-line no-console
      file = path.resolve(projectRoot, file)
      this.allFiles.add(file)
      this.pendingFiles.add(file)
      if (this.gotReady) this.processFile(file)
    })
    this.watcher.on('change', async (file: string): Promise<void> => {
      console.error('[dwmm] changed:', file) // eslint-disable-line no-console
      file = path.resolve(projectRoot, file)
      if (this.gotReady) this.processFile(file)
    })
    this.watcher.on('unlink', async (file: string): Promise<void> => {
      console.error('[dwmm] unlinked:', file) // eslint-disable-line no-console
      file = path.resolve(projectRoot, file)
      this.allFiles.delete(file)
      this.deletePendingFile(file)
      if (this.gotReady) this.index.undeclareModule(file)
    })
    await this.loadNatives().catch((error) => console.error(error.stack)) // eslint-disable-line no-console
  }

  emitProgress: () => void = throttle(() => {
    if (!this.gotReady) return
    this.emit('progress', this.getProgress())
  }, 50)

  stop() {
    if (!this.watcher) return
    this.watcher.close()
    this.watcher = null
  }
}

if (!module.parent) {
  const projectRoot = process.cwd()
  const parser = new FlowParser()
  const index = new SuggestedImportIndex({ projectRoot })

  const watcher = new WatchingIndexer({ projectRoot, parser, index })
  watcher.start()
  process.stdin.on('data', (query: Buffer) => {
    const identifier = query.toString('utf8').trim()
    index
      .suggest({
        identifier,
        file: path.join(projectRoot, 'index.js'),
      })
      .forEach((code) => console.log(code)) // eslint-disable-line no-console
  })
}
