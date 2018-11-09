import Client from '../src/Client'
import path from 'path'

const client = new Client(path.resolve(__dirname, '..'))
client
  .getSuggestedImports({
    file: __filename,
    identifier: 'Kind',
  })
  .then(
    async result => {
      console.log(result) // eslint-disable-line no-console
      await client.stopServer()
      process.exit(0)
    },
    async err => {
      console.error(err.stack) // eslint-disable-line no-console
      await client.stopServer()
      process.exit(1)
    }
  )
