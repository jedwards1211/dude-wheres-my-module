import { PassThrough } from 'stream'

export const stdout = new PassThrough()
export const stderr = new PassThrough()

stdout.pipe(process.stdout)
stderr.pipe(process.stderr)

function swallowEPIPE(err) {
  if (err.code === 'EPIPE') return
  throw err
}

stdout.on('error', swallowEPIPE)
stderr.on('error', swallowEPIPE)
process.stdout.on('error', swallowEPIPE)
process.stderr.on('error', swallowEPIPE)

export default new console.Console(stdout, stderr) // eslint-disable-line no-console
