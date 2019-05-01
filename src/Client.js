// @flow

import type { SuggestedImportResult } from './ModuleIndex'
import type { Progress } from './WatchingIndexer'
import net from 'net'
import tempFiles from './tempFiles'
import { spawn } from 'child_process'
import { promisify } from 'util'
import fs from 'fs-extra'
import delay from 'delay'
import stream from 'stream'
import JSONStream from 'JSONStream'
import EventEmitter from '@jcoreio/typed-event-emitter'
import findRoot from 'find-root'

import { type SuggestedImportsQuery } from './Server'

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

  async connect({
    startServer,
  }: {
    startServer?: ?boolean,
  } = {}): Promise<net.Socket> {
    const actuallyConnect = async (): Promise<net.Socket> => {
      const files = tempFiles(this.projectRoot)

      const client = await new Promise(
        (
          resolve: (client: net.Socket) => any,
          reject: (error: Error) => any
        ) => {
          let client,
            child,
            rejected = false

          const cleanup = () => {
            if (client != null) {
              client.removeListener('error', handleInitialError)
              client.removeListener('error', handleFinalError)
            }
            if (child != null) {
              child.removeListener('error', handleFinalError)
              child.removeListener('exit', handleExit)
            }
          }

          const handleExit = (code: ?number, signal: ?string) => {
            rejected = true
            cleanup()
            reject(
              new Error(
                code
                  ? `process exited with code ${code}`
                  : signal
                  ? `process was killed with ${signal}`
                  : `process exited`
              )
            )
          }

          const handleFinalError = (error: Error) => {
            rejected = true
            cleanup()
            reject(error)
          }

          const handleConnect = () => {
            cleanup()
            resolve(client)
          }
          const handleInitialError = async (error: Error): Promise<void> => {
            if (!startServer) {
              reject(error)
              return
            }
            child = spawn(
              process.env.DWMM_TEST ? 'babel-node' : process.execPath,
              [require.resolve('./Server'), this.projectRoot],
              {
                detached: true,
                stdio: 'ignore',
              }
            )
            child.on('error', handleFinalError)
            child.on('exit', handleExit)
            const startTime = Date.now()
            while (
              !rejected &&
              !(await fs.pathExists(files.sock).catch(() => false))
            ) {
              if (Date.now() - startTime > 10000) break
              await delay(500)
            }
            if (!rejected) {
              client = net.createConnection(files.sock, handleConnect)
              client.on('error', handleFinalError)
            }
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

    return await (this.client || (this.client = actuallyConnect()))
  }

  async request(message: $Diff<Message, { seq: number }>): Promise<any> {
    const seq = this.seq++
    const client = await this.connect({ startServer: true })
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
    try {
      await this.connect()
      // $FlowFixMe
      await promisify(cb => this.outstream.end({ stop: true }, cb))()
    } finally {
      this.client = null
    }
  }

  async killServer(): Promise<void> {
    try {
      await this.connect()
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
