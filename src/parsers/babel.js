// @flow

import path from 'path'
import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
} from '../ASTTypes'
import { readFile } from 'fs-extra'

export default class BabelParser {
  async parse(
    file: string
  ): Promise<
    Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
    >
  > {
    let parserPath = '@babel/core'
    if (file) {
      try {
        // $FlowFixMe
        parserPath = require.resolve('@babel/core', {
          paths: [path.dirname(file)],
        })
      } catch (err) {
        // ignore
      }
    }

    const code = await readFile(file, 'utf8')

    // $FlowFixMe
    const { parseAsync } = require(parserPath)
    const ast = await parseAsync(code, { filename: file, ast: true })

    function* declarations(): Iterable<
      | ImportDeclaration
      | ExportNamedDeclaration
      | ExportDefaultDeclaration
      | ExportAllDeclaration
    > {
      const body = ast.type === 'File' ? ast.program.body : ast.body
      for (let declaration of body) {
        switch (declaration.type) {
          case 'ImportDeclaration':
          case 'ExportNamedDeclaration':
          case 'ExportDefaultDeclaration':
          case 'ExportAllDeclaration':
            yield declaration
            break
        }
      }
    }
    return declarations()
  }
}
