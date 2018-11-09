// @flow

import '@babel/polyfill'
import ModuleIndex from './ModuleIndex'
import WatchingIndexer from './WatchingIndexer'
import FlowParser from './parsers/flow'
import type { SuggestedImportsQuery } from './ModuleIndex'
import type { Progress } from './WatchingIndexer'
import JSONStream from 'JSONStream'
import fs from 'fs-extra'
import lockFile from 'lockfile'
import net from 'net'
import tempFiles from './tempFiles'
import { promisify } from 'util'
import findRoot from 'find-root'

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

const index = new ModuleIndex({ projectRoot })
const indexer = new WatchingIndexer({
  projectRoot,
  index,
  parser: new FlowParser(),
})

const server = net
  .createServer()
  .listen(files.sock, () => console.log(`listening on ${files.sock}`)) // eslint-disable-line no-console

indexer.start()

async function cleanup(): Promise<void> {
  await Promise.all([
    promisify(cb => log.close(cb)),
    fs.remove(files.lock),
    fs.remove(files.sock),
    fs.remove(files.pids),
  ])
}

function handleSignal() {
  cleanup()
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
          getSuggestedImports: index.getSuggestedImports(getSuggestedImports),
        }
      } catch (error) {
        log.write(error.stack)
        message = {
          seq,
          error: error.stack,
        }
      }
      outstream.write(message)
    }
  })
  const handleProgress = (progress: Progress) => outstream.write({ progress })
  const handleReady = () => outstream.write({ ready: true })
  indexer.on('progress', handleProgress)
  indexer.on('ready', handleReady)
  function handleClose() {
    indexer.removeListener('progress', handleProgress)
    indexer.removeListener('ready', handleReady)
  }
  sock.on('close', handleClose)
  sock.on('error', handleClose)
  outstream.pipe(sock)
  sock.pipe(instream)
})
