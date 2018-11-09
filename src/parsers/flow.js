// @flow

import type {
  ImportDeclaration,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
} from '../ASTTypes'
import { readFile } from 'fs-extra'
import { parse } from 'flow-parser'
import type { Parser } from './Parser'

export default class FlowParser implements Parser {
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
    const code = await readFile(file, 'utf8')

    const ast = parse(code, {
      esproposal_decorators: true,
      esproposal_class_instance_fields: true,
      esproposal_class_static_fields: true,
      esproposal_export_star_as: true,
      esproposal_optional_chaining: true,
      esproposal_nullish_coalescing: true,
    })

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
