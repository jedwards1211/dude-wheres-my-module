// @flow

import path from 'path'
import { glob } from 'glob-gitignore'
import { readFile } from 'fs-extra'

export default async function loadIgnorePatterns({
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
          const patterns = (await readFile(
            path.resolve(projectRoot, file),
            'utf8'
          )).split(/\r\n?|\n/gm)
          const fileDir = path.dirname(file)
          if (file !== '.gitignore') {
            return patterns.map(pattern =>
              path.relative(projectRoot, path.resolve(fileDir, pattern))
            )
          }
          return patterns.filter(p => /\S/.test(p))
        }
      )
    ))
  )
}
