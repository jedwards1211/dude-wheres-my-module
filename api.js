const { spawn } = require('child_process')
const superagent = require('superagent')
const delay = require('delay')

module.exports = class API {
  constructor({ port } = {}) {
    this.port = port || 28275
  }

  async ensureRunning() {
    try {
      await superagent.get(`http://localhost:${this.port}/ping`).timeout(1000)
    } catch (error) {
      spawn(process.argv[0], [require.resolve('./index.js')], {
        cwd: __dirname,
        detached: true,
      })
      await delay(5000)
    }
  }

  async getSuggestedImports(options) {
    await this.ensureRunning()
    const { body } = await superagent
      .get(`http://localhost:${this.port}/suggestedImports`)
      .type('json')
      .accept('json')
      .send(options)
      .timeout(15000)
    return body
  }

  async getProgress(options) {
    await this.ensureRunning()
    const { body } = await superagent
      .get(`http://localhost:${this.port}/progress`)
      .type('json')
      .accept('json')
      .send(options)
      .timeout(15000)
    return body
  }
}
