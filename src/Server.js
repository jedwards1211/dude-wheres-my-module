// @flow

import '@babel/polyfill'
import ModuleIndex from './ModuleIndex'
import WatchingIndexer from './WatchingIndexer'
import FlowParser from './parsers/flow'
import type { Kind } from './ASTTypes'
import type { Progress } from './WatchingIndexer'
import JSONStream from 'JSONStream'
import fs from 'fs-extra'
import lockFile from 'lockfile'
import net from 'net'
import tempFiles from './tempFiles'
import { promisify } from 'util'
import findRoot from 'find-root'
import getSuggestedImportsFn from './getSuggestedImports'

export type SuggestedImportsQuery = $ReadOnly<{
  identifier?: string,
  code?: string,
  type?: Kind,
  file: string,
}>

export type Message = {
  seq: number,
  getSuggestedImports?: SuggestedImportsQuery,
  stop?: boolean,
  kill?: boolean,
}

if (!process.argv[2]) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <project dir>`) // eslint-disable-line no-console
  process.exit(1)
}
const projectRoot = findRoot(process.argv[2])
if (!fs.pathExistsSync(projectRoot)) {
  console.error(`Project dir doesn't exist: ${projectRoot}`) // eslint-disable-line no-console
  process.exit(1)
}

const files = tempFiles(projectRoot)

fs.mkdirpSync(files.dir)
try {
  lockFile.lockSync(files.lock)
} catch (err) {
  console.error(`Another server is already running`, err.stack) // eslint-disable-line no-console
  process.exit(1)
}

fs.writeFileSync(files.pids, `${process.pid}\tserver`, 'utf8')

const log = fs.createWriteStream(files.log, 'utf8')
const writeStdout = process.stdout.write
const writeStderr = process.stderr.write
// $FlowFixMe
process.stdout.write = (data: any) => {
  writeStdout.call(process.stdout, data)
  log.write(data)
}
// $FlowFixMe
process.stderr.write = (data: any) => {
  writeStderr.call(process.stderr, data)
  log.write(data)
}

const index = new ModuleIndex({ projectRoot })
const parser = new FlowParser()
const indexer = new WatchingIndexer({
  projectRoot,
  index,
  parser,
})

const server = net
  .createServer()
  .listen(files.sock, () => console.log(`listening on ${files.sock}`)) // eslint-disable-line no-console

indexer.start()
indexer.on('error', error => console.error(error.stack)) // eslint-disable-line no-console

async function cleanup(): Promise<void> {
  await Promise.all([
    promisify(cb => log.close(cb)),
    fs.remove(files.lock),
    fs.remove(files.sock),
    fs.remove(files.pids),
  ])
}

async function handleSignal(): Promise<any> {
  await cleanup()
  process.exit(1)
}

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

server.on('connection', (sock: net.Socket) => {
  const instream = JSONStream.parse('*')
  const outstream = JSONStream.stringify()
  instream.on('data', async (message: Message) => {
    const { seq, getSuggestedImports, stop, kill } = message
    if (stop) {
      await promisify(cb => server.close(cb))()
      await cleanup()
      process.exit(0)
    }
    if (kill) {
      server.close()
      cleanup()
      process.exit(1)
    }
    if (getSuggestedImports) {
      await indexer.waitUntilReady()
      let message
      try {
        message = {
          seq,
          getSuggestedImports: getSuggestedImports.code
            ? getSuggestedImportsFn({
                ...getSuggestedImports,
                parser,
                index,
              })
            : index.getSuggestedImports({ ...getSuggestedImports }),
        }
      } catch (error) {
        console.error(error.stack) // eslint-disable-line no-console
        message = {
          seq,
          error: error.stack,
        }
      }
      outstream.write(message)
    }
  })
  const handleProgress = (progress: Progress) => outstream.write({ progress })
  const handleError = (error: Error) =>
    outstream.write({ error: error.message })
  const handleReady = () => outstream.write({ ready: true })
  indexer.on('progress', handleProgress)
  indexer.on('ready', handleReady)
  indexer.on('error', handleError)
  function handleClose() {
    indexer.removeListener('progress', handleProgress)
    indexer.removeListener('ready', handleReady)
    indexer.removeListener('error', handleError)
  }
  sock.on('close', handleClose)
  sock.on('error', handleClose)
  outstream.pipe(sock)
  sock.pipe(instream)
})
