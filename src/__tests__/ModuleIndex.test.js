// @flow

import ModuleIndex from '../ModuleIndex'
import FlowParser from '../parsers/flow'
import path from 'path'
import { glob } from 'glob-gitignore'
import { expect } from 'chai'
import { describe, it } from 'mocha'

describe('ModuleIndex', function() {
  this.timeout(30000)
  describe(`declareModule`, function() {
    it(`basic test`, async function(): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new ModuleIndex({
        projectRoot,
      })

      for (let file of await glob('src/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        index.declareModule(file, await parser.parse({ file }))
      }
      for (let file of await glob('test/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        index.declareModule(file, await parser.parse({ file }))
      }

      expect(
        index.getSuggestedImports({
          identifier: 'sortBy',
          file: require.resolve('../parsers/flow'),
        })
      ).to.containSubset([{ code: 'import { sortBy } from "lodash"' }])

      expect(
        index.getSuggestedImports({
          identifier: 'ModuleInfo',
          file: __filename,
        })
      ).to.containSubset([
        { code: 'import { ModuleInfo } from "../ModuleIndex"' },
      ])

      expect(
        index.getSuggestedImports({
          identifier: 'Kind',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import { type Kind } from "../ASTTypes"' }])

      expect(index.getExports({ identifier: 'ModuleIndex' })).to.deep.equal([
        {
          file: require.resolve('../ModuleIndex'),
          identifier: 'default',
          kind: 'value',
        },
      ])

      expect(index.getExports({ identifier: 'Kind' })).to.deep.equal([
        {
          file: require.resolve('../ASTTypes'),
          identifier: 'Kind',
          kind: 'type',
        },
      ])

      expect(index.getExports({ identifier: 'ModuleInfo' })).to.deep.equal([
        {
          file: require.resolve('../ModuleIndex'),
          identifier: 'ModuleInfo',
          kind: 'value',
        },
      ])
    })
    it(`tolerates nonexistent imports`, async function(): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new ModuleIndex({
        projectRoot,
      })

      index.declareModule(
        path.join(__dirname, '..', '~test.js'),
        await parser.parse({
          code: `
          import glab from 'glab'
          import glomb from './glomb'
        `,
        })
      )

      expect(
        index.getSuggestedImports({
          identifier: 'glab',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import glab from "glab"' }])

      expect(
        index.getSuggestedImports({
          identifier: 'glomb',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import glomb from "../glomb"' }])
    })
  })
})
