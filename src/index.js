// @flow

import express, { type $Request, type $Response } from 'express'
import { fork, type ChildProcess } from 'child_process'
import findRoot from 'find-root'
import type { Server as HTTPServer } from 'http'
import type { SuggestedImportsQuery } from './ModuleIndex'

export type Message = {
  seq: number,
  start?: {
    projectRoot: string,
  },
  getSuggestedImports?: SuggestedImportsQuery,
  getProgress?: { file: string },
}

export default class Server {
  port: number
  childProcesses: Map<string, ChildProcess> = new Map()
  seq: number = 0
  callbacks: Map<number, Function> = new Map()
  server: HTTPServer

  constructor({ port }: { port?: ?number } = {}) {
    this.port = port || 28275
  }

  getChildProcess(file: string): ChildProcess {
    const projectRoot = findRoot(file)
    if (!projectRoot) throw new Error(`File is not in a node project: ${file}`)
    let child = this.childProcesses.get(projectRoot)
    if (!child) {
      child = fork(`${__dirname}/child.js`)
      child.send({ seq: this.seq++, start: { projectRoot } })
      this.childProcesses.set(projectRoot, child)
      child.on('message', (message: Message) => {
        const { seq } = message
        const callback = this.callbacks.get(seq)
        if (!callback) return
        this.callbacks.delete(seq)
        callback(message)
      })
      child.on('error', (err: Error) => {
        console.error(err.stack) // eslint-disable-line no-console
      })
    }
    return child
  }

  async requestFromChild(
    file: string,
    message: $Diff<Message, { seq: number }>
  ): Promise<any> {
    const child = this.getChildProcess(file)
    const seq = this.seq++
    return await new Promise(
      (resolve: (result: any) => any, reject: (error: Error) => any) => {
        function handleResult(result: any) {
          child.removeListener('error', handleError)
          resolve(result)
        }
        function handleError(error: Error) {
          child.removeListener('error', handleError)
          this.callbacks.delete(seq)
          reject(error)
        }
        this.callbacks.set(seq, handleResult)
        child.on('error', handleError)
        child.send({ seq, ...message })
      }
    )
  }

  start() {
    const app = express()

    app.get('/ping', (req: $Request, res: $Response) => {
      res.status(200).send()
    })

    app.get(
      '/suggestedImports',
      express.json(),
      async (req: $Request, res: $Response) => {
        const getSuggestedImports: SuggestedImportsQuery = req.body
        const { file } = getSuggestedImports
        try {
          const result = await this.requestFromChild(file, {
            getSuggestedImports,
          })
          res.status(200).json(result.getSuggestedImports)
        } catch (error) {
          res.status(500).send(error.stack)
        }
      }
    )

    app.get(
      '/progress',
      express.json(),
      async (req: $Request, res: $Response) => {
        const { file } = req.body
        try {
          const result = await this.requestFromChild(file, {
            getProgress: req.body,
          })
          res.status(200).json(result.getProgress)
        } catch (error) {
          res.status(500).send(error.stack)
        }
      }
    )

    app.get('/stop', express.json(), async (req: $Request, res: $Response) => {
      const { body } = req
      const file = body && body.file
      if (!file) {
        res.status(200).end()
        process.exit(0)
      }
      const projectRoot = findRoot(file)
      if (!projectRoot)
        throw new Error(`File is not in a node project: ${file}`)
      const child = this.childProcesses.get(projectRoot)
      if (!child) {
        res.status(404).end()
      } else {
        child.kill()
        this.childProcesses.delete(projectRoot)
        res.status(200).end()
      }
    })

    const { port } = this
    this.server = app.listen(
      port,
      () => console.log(`listening on port ${port}`) // eslint-disable-line no-console
    )
  }
}

if (!module.parent) {
  const server = new Server()
  server.start()
}
