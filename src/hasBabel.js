/**
 * @flow
 * @prettier
 */

import resolveInDir from './util/resolveInDir'

export default function hasBabel(projectDirectory: string): boolean {
  try {
    // $FlowFixMe
    resolveInDir('@babel/core', projectDirectory)
    // $FlowFixMe
    resolveInDir('@babel/traverse', projectDirectory)
  } catch (error) {
    return false
  }
  return true
}
