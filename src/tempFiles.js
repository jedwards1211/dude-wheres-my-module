// @flow

import path from 'path'
import os from 'os'

export default function tempFiles(projectRoot: string): {
  dir: string,
  lock: string,
  sock: string,
  pids: string,
  log: string,
} {
  const tmp = process.platform === 'win32' ? os.tmpdir() : '/tmp'
  const tempDir = path.join(
    tmp,
    'dude-wheres-my-module',
    process.env.DWMM_TEST ? 'test' : ''
  )
  const tempPrefix = path.join(tempDir, projectRoot.replace(/[:/\\]/g, 'zS'))
  return {
    dir: tempDir,
    lock: `${tempPrefix}.lock`,
    sock:
      process.platform === 'win32'
        ? `\\\\.\\pipe\\${projectRoot}\\dude-wheres-my-module`
        : `${tempPrefix}.sock`,
    pids: `${tempPrefix}.pids`,
    log: `${tempPrefix}.log`,
  }
}
