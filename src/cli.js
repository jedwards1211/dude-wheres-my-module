#!/usr/bin/env node
/* eslint-disable no-console */

import './checkNodeVersion'
import Client from './Client'
import findRoot from 'find-root'
import path from 'path'
import { eraseStartLine, cursorLeft } from 'ansi-escapes'
import chalk from 'chalk'
import tempFiles from './tempFiles'
import fs from 'fs-extra'

import { spawn } from 'child_process'

import emitted from 'p-event'

const projectRoot = findRoot(process.cwd())
const files = tempFiles(projectRoot)
const client = new Client(projectRoot)

async function withStatus<T>(fn: () => Promise<T>): Promise<T> {
  const handleProgress = ({ completed, total }) => {
    process.stderr.write(
      `${eraseStartLine}${cursorLeft}Server is starting... ${completed}/${total} (${Math.floor(
        (completed * 100) / total
      )}%)`
    )
  }
  client.on('progress', handleProgress)
  client.on('starting', () => {
    process.stderr.write('Server is starting...')
  })
  try {
    return await fn()
  } finally {
    client.removeListener('progress', handleProgress)
    process.stdout.write(eraseStartLine + cursorLeft)
  }
}

async function run(): Promise<void> {
  try {
    switch (process.argv[2]) {
      case 'log': {
        if (process.argv.includes('-f')) {
          spawn('tail', [...process.argv.slice(3), files.log], {
            stdio: 'inherit',
          })
          await new Promise(() => {})
        }
        const stream = fs.createReadStream(files.log, 'utf8')
        stream.pipe(process.stdout)
        await emitted(stream, 'end')
        break
      }
      case 'errors': {
        const log = await fs.readFile(files.log, 'utf8')
        const rx = /^.*?error:.*$/gim
        let match
        while ((match = rx.exec(log))) {
          console.log(match[0])
        }
        break
      }
      case 'stop': {
        console.error('Stopping server...')
        await client.stopServer()
        console.error('Stopped server')
        break
      }
      case 'stahp':
      case 'kill': {
        console.error('Killing server...')
        await client.killServer()
        console.error('Killed server')
        break
      }
      case 'wheres':
      case "where's":
      case 'suggest': {
        const argIndex = process.argv.indexOf('--file')
        const file =
          argIndex > 0
            ? path.resolve(projectRoot, process.argv[argIndex + 1])
            : path.join(projectRoot, 'index.js')
        if (argIndex > 0) process.argv.splice(argIndex, 2)

        let codeOrIdentifier = process.argv[3]
        if (!codeOrIdentifier) {
          codeOrIdentifier = await new Promise((resolve, reject) => {
            process.stdin.on('error', reject)
            const chunks = []
            process.stdin.on('data', data => chunks.push(data.toString('utf8')))
            process.stdin.on('end', () => resolve(chunks.join('')))
          })
        }
        const isIdentifierRequest = /^[a-z_][a-z0-9_]*$/i.test(codeOrIdentifier)

        let suggestions = await withStatus(() =>
          client.getSuggestedImports(
            isIdentifierRequest
              ? {
                  identifier: codeOrIdentifier,
                  file,
                }
              : {
                  code: codeOrIdentifier,
                  file,
                }
          )
        )

        if (isIdentifierRequest) {
          suggestions = suggestions[codeOrIdentifier].suggested
        }

        if (Array.isArray(suggestions)) {
          for (let { code } of suggestions) {
            console.log(code)
          }
          if (!suggestions.length) {
            console.error(chalk.gray('no suggestions'))
          }
        } else {
          for (let key in suggestions) {
            const { identifier, start, end, context, suggested } = suggestions[
              key
            ]
            console.log(
              `${chalk.bold(identifier)} (${start.line}:${
                start.column
              }) ${chalk.italic(
                `${context.substring(0, start.column)}${chalk.bold(
                  context.substring(start.column, end.column)
                )}${context.substring(end.column)}`
              )}`
            )
            for (let { code } of suggested) {
              console.log(`  ${code}`)
            }
            if (!suggested.length) {
              console.error(chalk.gray(`  no suggestions`))
            }
          }
          if (!Object.keys(suggestions).length) {
            console.error(chalk.gray('no suggestions'))
          }
        }
        break
      }
    }
  } finally {
    await client.close()
  }
}

run().then(
  () => process.exit(0),
  (err: Error) => {
    console.error(err.stack) // eslint-disable-line no-console
    process.exit(1)
  }
)
