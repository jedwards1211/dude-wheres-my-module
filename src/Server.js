// @flow

import './checkNodeVersion'
import '@babel/polyfill'
import SuggestedImportIndex from './SuggestedImportIndex'
import WatchingIndexer from './WatchingIndexer'
import FlowParser from './parsers/flow'
import type { Progress } from './WatchingIndexer'
import JSONStream from 'JSONStream'
import fs from 'fs-extra'
import lockFile from 'lockfile'
import touch from 'touch'
import net from 'net'
import tempFiles from './tempFiles'
import { promisify } from 'util'
import findRoot from 'find-root'
import getSuggestedImportsFn from './getSuggestedImports'
import console, { stdout, stderr } from './console'

import BabelParser from './parsers/babel'
import hasBabel from './hasBabel'

export type SuggestMessage = {
  code?: ?string,
  file: string,
}

export type WheresMessage = {
  identifier: string,
  file: string,
}

export type Message = {
  seq: number,
  suggest?: SuggestMessage,
  wheres?: WheresMessage,
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
  process.exit(2)
}

const files = tempFiles(projectRoot)

fs.mkdirpSync(files.dir)
try {
  fs.unlinkSync(files.sock)
} catch (error) {
  // ignore
}
const logFile = fs.createWriteStream(files.log, 'utf8')
stdout.pipe(logFile)
stderr.pipe(logFile)

process.on('uncaughtException', err => console.error(err.stack))
process.on('unhandledRejection', reason =>
  console.error((reason && reason.stack) || String(reason))
)

try {
  lockFile.lockSync(files.lock, { stale: 11000 })
} catch (err) {
  console.error(`Another server is already running`) // eslint-disable-line no-console
  process.exit(3)
}

const touchInterval = setInterval(() => {
  try {
    touch.sync(files.lock)
  } catch (error) {
    console.error(error.stack) // eslint-disable-line no-console
  }
}, 10000)

fs.writeFileSync(files.pids, `${process.pid}\tserver`, 'utf8')

const parser = hasBabel(projectRoot) ? new BabelParser() : new FlowParser()
const index = new SuggestedImportIndex({ projectRoot })
const indexer = new WatchingIndexer({
  projectRoot,
  index,
  parser,
})

const server = net
  .createServer()
  .listen(files.sock, () => console.error('[dwmm] listening on', files.sock)) // eslint-disable-line no-console

const logError = error => console.error(error.stack) // eslint-disable-line no-console

indexer.start()
indexer.on('error', logError)

async function cleanup(): Promise<void> {
  clearInterval(touchInterval)
  try {
    console.error('[dwmm]', 'unlocking', files.lock)
    lockFile.unlockSync(files.lock)
  } catch (error) {
    console.error(error.stack)
  }
  console.error('[dwmm]', 'removing', files.lock, files.sock, files.pids)
  await Promise.all([
    fs.remove(files.lock).catch(logError),
    fs.remove(files.sock).catch(logError),
    fs.remove(files.pids).catch(logError),
  ])
}

async function handleSignal(signal: any): Promise<any> {
  console.error('[dwmm]', 'got signal:', signal)
  await cleanup()
  process.exit(4)
}

process.on('SIGINT', handleSignal)
process.on('SIGTERM', handleSignal)

const sockets: Set<net.Socket> = new Set()

server.on('connection', (sock: net.Socket) => {
  sockets.add(sock)
  sock.on('close', () => sockets.delete(sock))
  const instream = JSONStream.parse('*')
  const outstream = JSONStream.stringify()
  instream.on('data', async (message: Message) => {
    console.error('[dwmm]', 'got message from client', message)
    const { seq, suggest, wheres, stop, kill } = message
    if (stop) {
      console.error('[dwmm]', 'got stop request')
      for (const sock of sockets) await promisify(cb => sock.end(cb))
      sockets.clear()
      await promisify(cb => server.close(cb))
      await cleanup()
      process.exit(0)
    }
    if (kill) {
      console.error('[dwmm]', 'got kill request')
      for (const sock of sockets) sock.destroy()
      sockets.clear()
      await promisify(cb => server.close(cb))
      await cleanup()
      process.exit(5)
    }
    if (suggest) {
      let message
      const { file } = suggest
      const code =
        suggest.code != null ? suggest.code : await fs.readFile(file, 'utf8')
      try {
        await indexer.waitUntilReady()
        const result = getSuggestedImportsFn({
          file,
          code,
          parser,
          index,
        })
        message = {
          seq,
          suggest: result,
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
    if (wheres) {
      let message
      const { file, identifier } = wheres
      try {
        await indexer.waitUntilReady()
        const result = {
          [identifier]: {
            identifier,
            suggested: index.suggest({ file, identifier }),
          },
        }
        message = {
          seq,
          wheres: result,
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
