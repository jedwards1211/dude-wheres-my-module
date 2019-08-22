// @flow

import path from 'path'
import { glob } from 'glob-gitignore'
import { readFile } from 'fs-extra'

export function gitignoreToChokidar(lines: Array<string>): Array<string> {
  const newLines = []
  lines.forEach((line: string) => {
    line = line.trim()
    if (!line.length || line.startsWith('#')) return
    const slashPos = line.indexOf('/')
    if (slashPos < 0) {
      // something like "*.js" which we need to interpret as [
      //  "**/*.js",
      //  "*.js/**", (in case it is a directory)
      //  "*.js"
      // ]
      newLines.push(`**/${line}`)
      newLines.push(`**/${line}/**`)
      newLines.push(`${line}/**`)
      newLines.push(line)
      return
    }
    if (slashPos === 0) {
      // something like "/node_modules" so we need to remove
      // the leading slash
      line = line.substring(1)
    }
    if (line.charAt(line.length - 1) === '/') {
      newLines.push(line.slice(0, -1))
      newLines.push(`${line}**`)
    } else {
      newLines.push(line)
    }
  })
  return newLines
}

export async function loadIgnoreFiles({
  projectRoot,
  globPattern = '**/.gitignore',
}: {
  projectRoot: string,
  globPattern?: string,
}): Promise<Array<string>> {
  const files = await glob(globPattern, {
    cwd: projectRoot,
    ignore: ['node_modules/**'],
  })
  return [].concat(
    ...(await Promise.all(
      files.map(
        async (file: string): Promise<Array<string>> => {
          const lines = (await readFile(
            path.resolve(projectRoot, file),
            'utf8'
          )).split(/\r\n?|\n/gm)
          const converted = gitignoreToChokidar(lines)
          const fileDir = path.dirname(file)
          if (file !== '.gitignore') {
            return converted.map(pattern => path.resolve(fileDir, pattern))
          }
          return converted
        }
      )
    ))
  )
}
