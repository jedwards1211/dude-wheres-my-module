const API = require('./api')

const api = new API()
api
  .getSuggestedImports({
    file: __filename,
    identifier: 'Kind',
  })
  .then(
    result => {
      console.log(result) // eslint-disable-line no-console
      process.exit(0)
    },
    err => {
      console.error(err.stack) // eslint-disable-line no-console
      process.exit(1)
    }
  )
