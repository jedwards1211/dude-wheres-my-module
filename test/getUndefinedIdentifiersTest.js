// @flow

import { describe, it } from 'mocha'

import FlowParser from '../src/parsers/flow'

describe(`getUndefinedIdentifiers`, function() {
  it(`works`, function() {
    const parser = new FlowParser()
    const identifiers = parser.getUndefinedIdentifiers(
      `#!/usr/bin/env node

      import Client from './client'
      import findRoot from 'find-root'
      import path from 'path'
      import { eraseStartLine, cursorLeft } from 'ansi-escapes'

      const projectRoot = findRoot(process.cwd())

      const client = new Client(projectRoot)

      async function withStatus<T>(fn: () => Promise<T>): Promise<T> {
        const listener = ({ completed, total }) => {
          process.stdout.write(
            \`\${eraseStartLine}\${cursorLeft}Server is starting... \${completed}/\${total} (\${Math.floor(
              (completed * 100) / total
            )}%)\`
          )
        }
        client.on('progress', listener)
        try {
          return await fn()
        } finally {
          client.removeListener('progress', listener)
          process.stdout.write(eraseStartLine + cursorLeft)
        }
      }

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

            const suggestions = await withStatus(() =>
              client.getSuggestedImports(
                /^[a-z_][a-z0-9_]*$/i.test(codeOrIdentifier)
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
            if (Array.isArray(suggestions)) {
              for (let { code } of suggestions) {
                console.log(code) // eslint-disable-line no-console
              }
            } else {
              for (let key in suggestions) {
                console.log(\`\${key}: (\${suggestions[key].line})\`) // eslint-disable-line no-console
                for (let suggestion of suggestions[key].suggested) {
                  console.log(\`  \${suggestion.code}\`) // eslint-disable-line no-console
                }
              }
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
      `
    )
    for (let { identifier, context } of identifiers) {
      console.log(identifier, context) // eslint-disable-line no-console
    }
  })
})
