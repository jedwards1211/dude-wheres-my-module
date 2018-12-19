#!/usr/bin/env babel-node
// @flow

import path from 'path'
import { spawn } from 'child_process'
import type { Parser } from './parsers/Parser'
import chokidar from 'chokidar'
import ModuleIndex from './ModuleIndex'
import FlowParser from './parsers/flow'
import { loadIgnoreFiles } from './gitignoreToChokidar'
import EventEmitter from '@jcoreio/typed-event-emitter'
import emitted from 'p-event'
import throttle from 'lodash/throttle'
import isConfigFile from './isConfigFile'
import console from './console'

export type Progress = { completed: number, total: number }

type Events = {
  ready: [],
  progress: [Progress],
  error: [Error],
}

export default class WatchingIndexer extends EventEmitter<Events> {
  projectRoot: string
  parser: Parser
  index: ModuleIndex
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
    index: ModuleIndex,
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

  async processFile(file: string): Promise<void> {
    file = path.resolve(this.projectRoot, file)
    this.allFiles.add(file)
    this.emitProgress()
    this.pendingFiles.add(file)
    try {
      if (isConfigFile(file)) {
        delete require.cache[file]
        const configure = require(file)
        const { preferredImports } = (await configure()) || {}
        if (preferredImports) {
          const code = Array.isArray(preferredImports)
            ? preferredImports.join('\n')
            : String(preferredImports)
          this.index.declareModule(file, await this.parser.parse({ code }))
        }
      } else {
        this.index.declareModule(file, await this.parser.parse({ file }))
      }
    } catch (error) {
      this.emit('error', error)
      this.allFiles.delete(file)
    } finally {
      this.pendingFiles.delete(file)
      if (this.isReady()) this.emit('ready')
      this.emitProgress()
    }
  }

  async loadNatives(): Promise<void> {
    const chunks = []
    const child = spawn('node', [require.resolve('./printNatives')], {
      cwd: this.projectRoot,
      stdio: 'pipe',
    })
    child.stdout.on('data', chunk => chunks.push(chunk))
    await new Promise((resolve: any, reject: any) => {
      const withCleanup = callback => (...args: any) => {
        child.removeListener('close', resolve)
        child.removeListener('error', reject)
        callback(...args)
      }
      child.on('close', withCleanup(resolve))
      child.on('error', withCleanup(reject))
    })
    const natives = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    const { index } = this
    for (let key in natives) {
      index.addExport(key, {
        file: key,
        kind: 'value',
        identifier: ('default': any),
        source: 'natives',
      })
      for (let identifier of natives[key]) {
        index.addExport(identifier, {
          file: key,
          kind: 'value',
          identifier,
          source: 'natives',
        })
      }
    }
  }

  async start(): Promise<void> {
    const { projectRoot } = this

    await this.loadNatives().catch(error => console.error(error.stack)) // eslint-disable-line no-console
    if (this.watcher) return
    this.watcher = chokidar.watch(
      ['**/*.js', '**/.dude-wheres-my-module.js', '**/*.jsx'],
      {
        ignored: [
          ...(await loadIgnoreFiles({ projectRoot })),
          file => !isConfigFile(file) && /(^|[/\\])\../.test(file),
        ],
        cwd: this.projectRoot,
      }
    )
    this.watcher.on('ready', () => {
      this.gotReady = true
      if (this.isReady()) this.emit('ready')
    })
    this.watcher.on('add', (file: string) => {
      console.error('[dwmm] added:', file) // eslint-disable-line no-console
      this.processFile(path.resolve(projectRoot, file))
    })
    this.watcher.on(
      'change',
      async (file: string): Promise<void> => {
        console.error('[dwmm] changed:', file) // eslint-disable-line no-console
        this.processFile(path.resolve(projectRoot, file))
      }
    )
    this.watcher.on(
      'unlink',
      async (file: string): Promise<void> => {
        console.error('[dwmm] unlinked:', file) // eslint-disable-line no-console
        this.allFiles.delete(file)
        this.pendingFiles.delete(file)
        file = path.resolve(projectRoot, file)
        this.index.undeclareModule(file)
      }
    )
  }

  emitProgress = throttle(() => {
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
  const index = new ModuleIndex({ projectRoot })

  const watcher = new WatchingIndexer({ projectRoot, parser, index })
  watcher.start()
  process.stdin.on('data', (query: Buffer) => {
    const identifier = query.toString('utf8').trim()
    index
      .getSuggestedImports({
        identifier,
        file: path.join(projectRoot, 'index.js'),
      })
      .forEach(code => console.log(code)) // eslint-disable-line no-console
  })
}
