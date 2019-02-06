/**
 * @flow
 * @prettier
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'

import FlowParser from '../parsers/flow'
import ModuleIndex from '../ModuleIndex'
import path from 'path'
import WatchingIndexer from '../WatchingIndexer'

describe(`WatchingIndexer`, function() {
  describe(`loadNatives`, function() {
    it(`loaded natives are found by ModuleIndex`, async function(): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new ModuleIndex({
        projectRoot,
      })
      const watcher = new WatchingIndexer({
        projectRoot,
        parser,
        index,
      })
      await watcher.loadNatives()
      expect(
        index.getSuggestedImports({ file: __filename, identifier: 'spawn' })
      ).to.deep.equal([{ code: 'import { spawn } from "child_process"' }])
      expect(
        index.getSuggestedImports({ file: __filename, identifier: 'vm' })
      ).to.deep.equal([{ code: 'import vm from "vm"' }])
    })
  })
})
