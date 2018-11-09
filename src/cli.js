#!/usr/bin/env node

import Client from './client'
import findRoot from 'find-root'
import path from 'path'
import { eraseStartLine, cursorLeft } from 'ansi-escapes'

const projectRoot = findRoot(process.cwd())

const client = new Client(projectRoot)

async function run(): Promise<void> {
  switch (process.argv[2]) {
    case 'stop': {
      await client.stopServer()
      break
    }
    case 'kill': {
      await client.killServer()
      break
    }
    case 'suggest': {
      const argIndex = process.argv.indexOf('--file')
      const file =
        argIndex > 0
          ? path.resolve(projectRoot, process.argv[argIndex + 1])
          : path.join(projectRoot, 'index.js')

      client.on('progress', ({ completed, total }) => {
        process.stdout.write(
          `${eraseStartLine}${cursorLeft}Server is starting... ${completed}/${total} (${Math.floor(
            (completed * 100) / total
          )}%)`
        )
      })
      client.on('ready', () =>
        process.stdout.write(eraseStartLine + cursorLeft)
      )

      const suggestions = await client.getSuggestedImports({
        identifier: process.argv[3],
        file,
      })
      process.stdout.write(eraseStartLine + cursorLeft)
      for (let { code } of suggestions) {
        console.log(code) // eslint-disable-line no-console
      }
      break
    }
  }
}

run().then(
  () => process.exit(0),
  (err: Error) => {
    console.error(err.stack) // eslint-disable-line no-console
    process.exit(1)
  }
)
