// @flow

import type { Progress } from './WatchingIndexer'
import net from 'net'
import Path from 'path'
import tempFiles from './tempFiles'
import { spawn } from 'child_process'
import { promisify } from 'util'
import stream from 'stream'
import JSONStream from 'JSONStream'
import EventEmitter from '@jcoreio/typed-event-emitter'
import { findRootSync } from './util/findRoot'
import { type SuggestMessage, type WheresMessage } from './DudeServer'
import { type SuggestResult } from './SuggestedImportIndex'
import poll from '@jcoreio/poll'
import emitted from 'p-event'

import {
  EXIT_CODE_INVALID_ARGS,
  EXIT_CODE_PROJECT_DIR_DOESNT_EXIST,
  EXIT_CODE_ANOTHER_SERVER_IS_RUNNING,
  EXIT_CODE_KILLED_BY_CLIENT,
} from './exitCodes'

export type Message = {
  seq: number,
  suggest?: SuggestMessage,
  wheres?: WheresMessage,
}

type Events = {
  ready: [],
  progress: [Progress],
  starting: [],
}

async function connected(socket: net.Socket): Promise<void> {
  await emitted(socket, 'connect', {
    rejectionEvents: ['error', 'exit'],
    timeout: 10000,
  })
}

export default class Client extends EventEmitter<Events> {
  projectRoot: string
  client: ?Promise<net.Socket>
  seq: number = 0
  instream: stream.Transform
  outstream: stream.Transform
  callbacks: Map<number, { resolve: (any) => any, reject: (Error) => any }> =
    new Map()

  constructor(projectRoot: string) {
    super()
    this.projectRoot = findRootSync(projectRoot)
    this.instream = new JSONStream.parse('*')
    this.outstream = new JSONStream.stringify()
  }

  _createClient: () => Promise<net.Socket> = async (): Promise<net.Socket> => {
    const files = tempFiles(this.projectRoot)

    let client: net.Socket
    try {
      // in case a server is already running, try to connect to the socket
      client = net.createConnection(files.sock)
      await connected(client)
    } catch (error) {
      // seems like no server is running, spawn a new server
      this.emit('starting')
      let command = process.env.DWMM_TEST
        ? Path.resolve(__dirname, '..', 'node_modules', '.bin', 'babel-node')
        : process.execPath
      if (!/node$/.test(command)) command = 'node'
      const args = [require.resolve('./DudeServer'), this.projectRoot]
      const server = spawn(command, args, {
        detached: true,
        stdio: 'ignore',
        cwd: this.projectRoot,
      })

      const serverExited: Promise<any> = new Promise(
        (resolve: (any) => void, reject: (Error) => void) => {
          server.once('error', (error: Error) => {
            error = new Error(`error spawning server: ${error.message}`)
            if (client) client.emit('error', error)
            reject(error)
          })
          server.once('exit', (code: ?number, signal: ?string) => {
            try {
              if (code) {
                if (code > 128) {
                  throw new Error(
                    `server shutdown after receiving signal ${code - 128}`
                  )
                }
                switch (code) {
                  case 0:
                    throw new Error(`server was stopped by client request`)
                  case EXIT_CODE_INVALID_ARGS:
                    throw new Error(
                      `invalid arguments to server: ${args.slice(1).join(' ')}`
                    )
                  case EXIT_CODE_PROJECT_DIR_DOESNT_EXIST:
                    throw new Error(
                      `project directory doesn't exist: ${this.projectRoot}`
                    )
                  case EXIT_CODE_ANOTHER_SERVER_IS_RUNNING:
                    throw new Error(
                      `another server is already running, but failed to connect to it`
                    )
                  case EXIT_CODE_KILLED_BY_CLIENT:
                    throw new Error(`server was killed by client request`)
                }
              }
              throw new Error(
                signal
                  ? `server was killed with signal ${signal}`
                  : `server exited with code ${String(code)}`
              )
            } catch (error) {
              if (client) client.emit('error', error)
              reject(error)
            }
          })
        }
      )

      client = await Promise.race([
        // keep trying to connect to the socket in case the server is
        // slow to start up
        poll<net.Socket>(async (): Promise<net.Socket> => {
          const client = net.createConnection(files.sock)
          await connected(client)
          return client
        }, 1000).timeout(30000),
        serverExited,
      ])
    }

    client.pipe(this.instream)
    this.outstream.pipe(client)

    this.instream.on(
      'data',
      (message: {
        seq?: number,
        progress?: Progress,
        ready?: boolean,
        error?: string,
      }) => {
        const { seq, progress, ready, error } = message
        if (seq != null) {
          const callbacks = this.callbacks.get(seq)
          if (callbacks) {
            this.callbacks.delete(seq)
            if (error) callbacks.reject(new Error(error))
            else callbacks.resolve(message)
          }
        }
        if (progress) this.emit('progress', progress)
        if (ready) this.emit('ready')
      }
    )

    client.once('error', () => {
      this.client = null
    })

    return client
  }

  async connect({
    startServer,
  }: {
    startServer?: ?boolean,
  } = {}): Promise<net.Socket> {
    if (this.client) return await this.client
    return await (this.client = this._createClient())
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

        this.callbacks.set(seq, {
          resolve: handleResult,
          reject: handleError,
        })
        client.once('error', handleError)
        // $FlowFixMe
        this.outstream.write({ seq, ...message })
      }
    )
  }

  async waitUntilReady(): Promise<void> {
    await this.request({ waitUntilReady: {} })
  }

  async wheres(query: WheresMessage): Promise<Array<SuggestResult>> {
    const { wheres } = await this.request({
      wheres: query,
    })
    return wheres
  }

  async suggest(query: SuggestMessage): Promise<SuggestResult> {
    const { suggest } = await this.request({
      suggest: query,
    })
    return suggest
  }

  async stopServer(): Promise<void> {
    try {
      const client: net.Socket = await this.connect()
      // $FlowFixMe
      this.outstream.write({ stop: true })
      await promisify((cb) => client.end(cb))()
    } finally {
      this.client = null
    }
  }

  async killServer(): Promise<void> {
    try {
      const client: net.Socket = await this.connect()
      // $FlowFixMe
      this.outstream.write({ kill: true })
      client.end()
    } finally {
      this.client = null
    }
  }

  async close(): Promise<void> {
    try {
      if (this.client) {
        const client = await this.client
        await promisify((cb) => client.end(cb))
      }
    } catch (error) {
      // ignore
    } finally {
      this.client = null
    }
  }
}
