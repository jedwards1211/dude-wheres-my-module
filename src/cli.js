#!/usr/bin/env node
/* eslint-disable no-console */

import './checkNodeVersion'
import yargs from 'yargs'
import Client from './Client'
import { findRootSync } from './util/findRoot'
import path from 'path'
import { eraseStartLine, cursorLeft } from 'ansi-escapes'
import chalk from 'chalk'
import tempFiles from './tempFiles'
import fs from 'fs-extra'
import { spawn } from 'child_process'
import { isEmpty, flatMap } from 'lodash/fp'
import emitted from 'p-event'
import glob from 'glob'

const projectRoot = findRootSync(process.cwd())
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

const shellCommand = path.isAbsolute(process.argv[1])
  ? path.basename(process.argv[1])
  : `${path.basename(process.argv[0])} ${process.argv[1]}`

const runCommand =
  (fn: (argv: Object) => Promise<any>) =>
  async (argv: Object): Promise<any> => {
    try {
      await fn(argv)
    } catch (error) {
      console.error(error.stack) // eslint-disable-line no-console
      process.exit(1)
    } finally {
      await client.close()
    }
    process.exit(0)
  }

yargs
  .command(
    'log',
    'output log file',
    function (yargs) {
      yargs.usage('$0 log [-f [<tail options>]]').option('f', {
        alias: 'follow',
        type: 'boolean',
        describe: 'follow tail of log file',
      })
    },
    runCommand(async function (argv): Promise<void> {
      const { follow, _ } = argv
      if (follow) {
        spawn('tail', ['-f', ..._, files.log], {
          stdio: 'inherit',
        })
        await new Promise(() => {})
      }
      const stream = fs.createReadStream(files.log, 'utf8')
      stream.pipe(process.stdout)
      await emitted(stream, 'end')
    })
  )
  .command(
    'errors',
    'output errors from log file',
    runCommand(async function (argv): Promise<void> {
      const log = await fs.readFile(files.log, 'utf8')
      const rx = /^.*?error:.*$/gim
      let match
      while ((match = rx.exec(log))) {
        console.log(match[0])
      }
    })
  )
  .command(
    'stop',
    'stop server gracefully',
    runCommand(async function (yargs): Promise<void> {
      console.error('Stopping server...')
      await client.stopServer()
      console.error('Stopped server')
    })
  )
  .command(
    ['stahp', 'kill'],
    'stop server forcefully',
    runCommand(async function (yargs): Promise<void> {
      console.error('Killing server...')
      await client.killServer()
      console.error('Killed server')
    })
  )
  .command(
    ['wheres <identifier>', "where's <identifier>"],
    'suggest imports for an identifier',
    function (yargs) {
      yargs
        .positional('identifier', {
          describe: 'the identifier to suggest imports for',
          type: 'string',
        })
        .option('file', {
          type: 'string',
          describe: 'import paths will be given relative to this file',
        })
    },
    runCommand(async function (argv): Promise<void> {
      const { identifier } = argv
      const file = path.resolve(argv.file || 'index.js')

      if (!identifier) {
        console.error(
          `Usage: ${shellCommand} ${process.argv[2]} <identifier> [--file <file>]`
        )
        process.exit(1)
      }

      const {
        [identifier]: { suggested: suggestions },
      } = await withStatus(() =>
        client.wheres({
          identifier,
          file,
        })
      )

      for (let { code } of suggestions) {
        console.log(code)
      }
      if (!suggestions.length) {
        console.error(chalk.gray('no suggestions'))
      }
    })
  )
  .command(
    'suggest <files...>',
    'suggest imports for undeclared identifiers in a file',
    function (yargs) {
      yargs.positional('files', {
        describe: 'the .js files containing code to suggest imports for',
        type: 'string',
      })
    },
    runCommand(async function (argv): Promise<void> {
      const files = flatMap((f) =>
        glob.hasMagic(f) ? glob.sync(path.resolve(f)) : f
      )(argv.files)
      for (const f of files) {
        const file = path.resolve(f)
        const code = await fs.readFile(file, 'utf8')
        const suggestions = await withStatus(() =>
          client.suggest({
            code,
            file,
          })
        )

        if (files.length > 1 && !isEmpty(suggestions)) {
          console.log(file)
        }
        for (let key in suggestions) {
          const { identifier, start, end, context, suggested } =
            suggestions[key]
          let output = `${chalk.bold(identifier)} (${start.line}:${
            start.column
          }) ${chalk.italic(
            `${context.substring(0, start.column)}${chalk.bold(
              context.substring(start.column, end.column)
            )}${context.substring(end.column)}`
          )}`
          if (files.length > 1) output = output.replace(/^/gm, '  ')
          console.log(output)
          for (let { code } of suggested) {
            console.log(files.length > 1 ? '    ' : '  ' + code)
          }
          if (!suggested.length) {
            console.error(
              chalk.gray((files.length > 1 ? '    ' : '  ') + 'no suggestions')
            )
          }
        }
        if (isEmpty(suggestions) && files.length <= 1) {
          console.error(chalk.gray('no suggestions'))
        }
      }
    })
  )
  .demandCommand()
  .version()
  .help()

yargs.argv
