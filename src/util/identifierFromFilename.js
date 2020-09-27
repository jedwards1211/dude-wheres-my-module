// @flow

import camelCase from 'lodash/camelCase'
import upperFirst from 'lodash/upperFirst'
import path from 'path'

export default function identifierFromFilename(file: string): string {
  file = path.basename(file)
  const identifier = camelCase(file.replace(/\.[^/]+$/, ''))
  return file[0].toUpperCase() === file[0] ? upperFirst(identifier) : identifier
}
