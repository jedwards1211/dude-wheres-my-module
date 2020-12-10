/**
 * @flow
 * @prettier
 */

import { resolveInDirSync } from './util/resolveInDir'

export default function hasBabel(projectDirectory: string): boolean {
  try {
    // $FlowFixMe
    resolveInDirSync('@babel/core', projectDirectory)
    // $FlowFixMe
    resolveInDirSync('@babel/traverse', projectDirectory)
  } catch (error) {
    return false
  }
  return true
}
