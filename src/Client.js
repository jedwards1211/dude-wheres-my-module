// @flow

import type { SuggestedImportsResult } from './getSuggestedImports'
import type { Progress } from './WatchingIndexer'
import net from 'net'
import tempFiles from './tempFiles'
import { spawn } from 'child_process'
import { promisify } from 'util'
import stream from 'stream'
import JSONStream from 'JSONStream'
import EventEmitter from '@jcoreio/typed-event-emitter'
import findRoot from 'find-root'
import { type SuggestMessage, type WheresMessage } from './Server'
import { type SuggestedImportResult } from './ModuleIndex'
import poll from '@jcoreio/poll'
import emitted from 'p-event'

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
  callbacks: Map<
    number,
    { resolve: any => any, reject: Error => any }
  > = new Map()

  constructor(projectRoot: string) {
    super()
    this.projectRoot = findRoot(projectRoot)
    this.instream = new JSONStream.parse('*')
    this.outstream = new JSONStream.stringify()
  }

  _createClient = async (): Promise<net.Socket> => {
    const files = tempFiles(this.projectRoot)

    let client: net.Socket
    try {
      // in case a server is already running, try to connect to the socket
      client = net.createConnection(files.sock)
      await connected(client)
    } catch (error) {
      // seems like no server is running, spawn a new server
      this.emit('starting')
      let command = process.env.DWMM_TEST ? 'babel-node' : process.execPath
      if (!/node$/.test(command)) command = 'node'
      const server = spawn(
        command,
        [require.resolve('./Server'), this.projectRoot],
        {
          detached: true,
          stdio: 'ignore',
          cwd: this.projectRoot,
        }
      )

      client = await Promise.race([
        // keep trying to connect to the socket in case the server is
        // slow to start up
        poll(async (): Promise<net.Socket> => {
          const client = net.createConnection(files.sock)
          await connected(client)
          return client
        }, 1000).timeout(30000),
        // fail immediately if the server process exits
        emitted(server, '', { rejectionEvents: ['exit', 'error'] }),
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

        this.callbacks.set(seq, { resolve: handleResult, reject: handleError })
        client.on('error', handleError)
        // $FlowFixMe
        this.outstream.write({ seq, ...message })
      }
    )
  }

  async wheres(query: WheresMessage): Promise<Array<SuggestedImportResult>> {
    const { wheres } = await this.request({
      wheres: query,
    })
    return wheres
  }

  async suggest(query: SuggestMessage): Promise<SuggestedImportsResult> {
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
      await promisify(cb => client.end(cb))()
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
        await promisify(cb => client.end(cb))
      }
    } catch (error) {
      // ignore
    } finally {
      this.client = null
    }
  }
}
