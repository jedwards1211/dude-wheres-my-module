/**
 * @flow
 * @prettier
 */

import { describe, it, after } from 'mocha'
import { expect } from 'chai'
import Client from '../Client'
import findRoot from 'find-root'

const projectRoot = findRoot(process.cwd())
const client = new Client(projectRoot)

describe(`Client`, function() {
  this.timeout(30000)

  after(async function(): Promise<void> {
    this.timeout(5000)
    await client.close()
  })

  it(`basic integration test`, async function(): Promise<void> {
    expect(
      await client.getSuggestedImports({
        file: __filename,
        code: 'const client = new Client(__filename)',
      })
    ).to.containSubset({
      Client: {
        identifier: 'Client',
        context: 'const client = new Client(__filename)',
        suggested: [{ code: 'import Client from "../Client"' }],
      },
    })
    expect(
      await client.getSuggestedImports({
        file: __filename,
        identifier: 'spawn',
      })
    ).to.deep.equal({
      spawn: {
        identifier: 'spawn',
        suggested: [{ code: 'import { spawn } from "child_process"' }],
      },
    })
  })
})
