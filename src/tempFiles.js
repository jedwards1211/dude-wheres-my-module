// @flow

import path from 'path'

export default function tempFiles(
  projectRoot: string
): {
  dir: string,
  lock: string,
  sock: string,
  pids: string,
  log: string,
} {
  const tmp = '/tmp'
  const tempDir = path.join(tmp, 'dude-wheres-my-module')
  const tempPrefix = path.join(tempDir, projectRoot.replace(/[/\\]/g, 'zS'))
  return {
    dir: tempDir,
    lock: `${tempPrefix}.lock`,
    sock: `${tempPrefix}.sock`,
    pids: `${tempPrefix}.pids`,
    log: `${tempPrefix}.log`,
  }
}
