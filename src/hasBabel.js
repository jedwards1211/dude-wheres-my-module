/**
 * @flow
 * @prettier
 */

export default function hasBabel(projectDirectory: string): boolean {
  try {
    // $FlowFixMe
    require.resolve('@babel/core', { paths: [projectDirectory] })
    // $FlowFixMe
    require.resolve('@babel/traverse', { paths: [projectDirectory] })
  } catch (error) {
    return false
  }
  return true
}
