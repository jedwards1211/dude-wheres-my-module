// @flow

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

export type Message = {
  seq: number,
  getSuggestedImports?: SuggestedImportsQuery,
  stop?: boolean,
  kill?: boolean,
}

const projectRoot = process.argv[2]
if (!projectRoot) {
  console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <project dir>`) // eslint-disable-line no-console
  process.exit(1)
}
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
    fs.remove(files.lock),
    fs.remove(files.sock),
    fs.remove(files.pids),
  ])
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

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
      const message = {
        seq,
        getSuggestedImports: index.getSuggestedImports(getSuggestedImports),
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
