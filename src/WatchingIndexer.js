#!/usr/bin/env babel-node
// @flow

import path from 'path'
import type { Parser } from './parsers/Parser'
import chokidar from 'chokidar'
import ModuleIndex from './ModuleIndex'
import FlowParser from './parsers/flow'
import { loadIgnoreFiles } from './gitignoreToChokidar'
import EventEmitter from '@jcoreio/typed-event-emitter'
import emitted from 'p-event'
import throttle from 'lodash/throttle'

type Progress = { completed: number, total: number }

type Events = {
  ready: [],
  progress: [Progress],
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
    this.index.declareModule(file, await this.parser.parse(file))
    this.pendingFiles.delete(file)
    if (this.isReady()) this.emit('ready')
    this.emitProgress()
  }

  async start(): Promise<void> {
    const { projectRoot } = this

    if (this.watcher) return
    this.watcher = chokidar.watch(['**/*.js', '**/*.jsx'], {
      ignored: [/(^|[/\\])\../, ...(await loadIgnoreFiles({ projectRoot }))],
      cwd: this.projectRoot,
    })
    this.watcher.on('ready', () => {
      this.gotReady = true
      if (this.isReady()) this.emit('ready')
    })
    this.watcher.on('add', (file: string) => {
      console.error('added:', file) // eslint-disable-line no-console
      this.processFile(path.resolve(projectRoot, file))
    })
    this.watcher.on(
      'change',
      async (file: string): Promise<void> => {
        console.error('changed:', file) // eslint-disable-line no-console
        this.processFile(path.resolve(projectRoot, file))
      }
    )
    this.watcher.on(
      'unlink',
      async (file: string): Promise<void> => {
        console.error('unlinked:', file) // eslint-disable-line no-console
        this.allFiles.delete(file)
        this.pendingFiles.delete(file)
        file = path.resolve(projectRoot, file)
        this.index.undeclareModule(file)
      }
    )
  }

  emitProgress = throttle(() => {
    this.emit('progress', this.getProgress())
  }, 1000)

  stop() {
    if (!this.watcher) return
    this.watcher.close()
    this.watcher = null
  }
}

if (!module.parent) {
  const projectRoot = process.cwd()
  const index = new ModuleIndex({ projectRoot })
  const parser = new FlowParser()

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
