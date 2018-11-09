// @flow

import type {
  SuggestedImportsQuery,
  SuggestedImportResult,
} from './ModuleIndex'
import type { Progress } from './WatchingIndexer'
import net from 'net'
import tempFiles from './tempFiles'
import { spawn } from 'child_process'
import { promisify } from 'util'
import delay from 'delay'
import stream from 'stream'
import JSONStream from 'JSONStream'
import EventEmitter from '@jcoreio/typed-event-emitter'
import findRoot from 'find-root'

export type Message = {
  seq: number,
  getSuggestedImports?: SuggestedImportsQuery,
}

type Events = {
  ready: [],
  progress: [Progress],
}

export default class Client extends EventEmitter<Events> {
  projectRoot: string
  client: ?Promise<net.Socket>
  seq: number = 0
  instream: stream.Transform
  outstream: stream.Transform
  callbacks: Map<number, (result: any) => any> = new Map()

  constructor(projectRoot: string) {
    super()
    this.projectRoot = findRoot(projectRoot)
    this.instream = new JSONStream.parse('*')
    this.outstream = new JSONStream.stringify()
  }

  async start(): Promise<net.Socket> {
    const actuallyStart = async (): Promise<net.Socket> => {
      const files = tempFiles(this.projectRoot)

      const client = await new Promise(
        (
          resolve: (client: net.Socket) => any,
          reject: (error: Error) => any
        ) => {
          let client

          const handleConnect = () => {
            client.removeListener('error', handleInitialError)
            client.removeListener('error', reject)
            resolve(client)
          }
          const handleInitialError = async (): Promise<void> => {
            spawn('node', [require.resolve('./Server'), this.projectRoot], {
              detached: true,
            })
            await delay(3000)
            client = net.createConnection(files.sock, handleConnect)
            client.on('error', reject)
          }

          client = net.createConnection(files.sock, handleConnect)
          client.on('error', handleInitialError)
        }
      )

      client.pipe(this.instream)
      this.outstream.pipe(client)

      this.instream.on(
        'data',
        (message: { seq?: number, progress?: Progress, ready?: boolean }) => {
          const { seq, progress, ready } = message
          if (seq != null) {
            const callback = this.callbacks.get(seq)
            if (callback) {
              this.callbacks.delete(seq)
              callback(message)
            }
          }
          if (progress) this.emit('progress', progress)
          if (ready) this.emit('ready')
        }
      )

      return client
    }

    return await (this.client || (this.client = actuallyStart()))
  }

  async request(message: $Diff<Message, { seq: number }>): Promise<any> {
    const seq = this.seq++
    const client = await this.start()
    return await new Promise(
      (resolve: (result: any) => any, reject: (error: Error) => any) => {
        const handleResult = (result: any) => {
          client.removeListener('error', handleError)
          if (result.error) reject(result.error)
          else resolve(result)
        }
        const handleError = (error: Error) => {
          client.removeListener('error', handleError)
          this.callbacks.delete(seq)
          reject(error)
        }

        this.callbacks.set(seq, handleResult)
        client.on('error', handleError)
        // $FlowFixMe
        this.outstream.write({ seq, ...message })
      }
    )
  }

  async getSuggestedImports(
    query: SuggestedImportsQuery
  ): Promise<Array<SuggestedImportResult>> {
    const { getSuggestedImports } = await this.request({
      getSuggestedImports: query,
    })
    return getSuggestedImports
  }

  async stopServer(): Promise<void> {
    if (!this.client) return
    try {
      // $FlowFixMe
      await promisify(cb => this.outstream.end({ stop: true }, cb))()
    } finally {
      this.client = null
    }
  }

  async killServer(): Promise<void> {
    if (!this.client) return
    try {
      // $FlowFixMe
      await promisify(cb => this.outstream.end({ kill: true }, cb))()
    } finally {
      this.client = null
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client) {
        const client = await this.client
        await promisify(cb => client.end(cb))()
      }
    } catch (error) {
      // ignore
    } finally {
      this.client = null
    }
  }
}
