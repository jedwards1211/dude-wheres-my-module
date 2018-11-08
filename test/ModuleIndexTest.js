// @flow

import ModuleIndex from '../src/ModuleIndex'
import BabelParser from '../src/parsers/babel'
import path from 'path'
import { glob } from 'glob-gitignore'
import { expect } from 'chai'

describe('ModuleIndex', function() {
  this.timeout(30000)
  describe(`declareModule`, function() {
    it(`basic test`, async function(): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..')
      const index = new ModuleIndex({
        projectRoot,
      })
      const parser = new BabelParser()

      for (let file of await glob('src/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        index.declareModule(file, await parser.parse(file))
      }
      for (let file of await glob('test/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        index.declareModule(file, await parser.parse(file))
      }

      expect(
        index.getSuggestedImports({
          identifier: 'sortBy',
          file: require.resolve('../src/parsers/babel'),
        })
      ).to.deep.equal(['import sortBy from "lodash/sortBy"'])

      expect(
        index.getSuggestedImports({
          identifier: 'ModuleInfo',
          file: __filename,
        })
      ).to.deep.equal(['import { ModuleInfo } from "../src/ModuleIndex"'])

      expect(
        index.getSuggestedImports({
          identifier: 'Kind',
          file: __filename,
        })
      ).to.deep.equal(['import { type Kind } from "../src/ASTTypes"'])

      expect(index.getExports({ identifier: 'ModuleIndex' })).to.deep.equal([
        {
          file: require.resolve('../src/ModuleIndex'),
          identifier: 'default',
          kind: 'value',
        },
      ])

      expect(index.getExports({ identifier: 'Kind' })).to.deep.equal([
        {
          file: require.resolve('../src/ASTTypes'),
          identifier: 'Kind',
          kind: 'type',
        },
      ])

      expect(index.getExports({ identifier: 'ModuleInfo' })).to.deep.equal([
        {
          file: require.resolve('../src/ModuleIndex'),
          identifier: 'ModuleInfo',
          kind: 'value',
        },
      ])
    })
  })
})
