// @flow

import SuggestedImportIndex from '../SuggestedImportIndex'
import FlowParser from '../parsers/flow'
import path from 'path'
import { glob } from 'glob-gitignore'
import { expect } from 'chai'
import { describe, it } from 'mocha'
import fs from 'fs-extra'

describe('SuggestedImportIndex', function () {
  this.timeout(30000)
  describe(`declareModule`, function () {
    it(`basic test`, async function (): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new SuggestedImportIndex({
        projectRoot,
      })

      for (let file of await glob('src/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        const code = await fs.readFile(file, 'utf8')
        await index.declareModule(file, parser.parse({ code, file }))
      }
      for (let file of await glob('test/**/*.js', { cwd: projectRoot })) {
        file = path.resolve(projectRoot, file)
        const code = await fs.readFile(file, 'utf8')
        await index.declareModule(file, parser.parse({ code, file }))
      }

      expect(
        index.suggest({
          identifier: 'jscodeshift',
          file: require.resolve('../parsers/flow'),
        })
      ).to.containSubset([{ code: 'import jscodeshift from "jscodeshift"' }])

      expect(
        index.suggest({
          identifier: 'SuggestedImportSource',
          file: __filename,
        })
      ).to.containSubset([
        {
          code: 'import { SuggestedImportSource } from "../SuggestedImportIndex"',
        },
      ])

      expect(
        index.suggest({
          identifier: 'Kind',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import { type Kind } from "../ASTTypes"' }])

      expect(
        index.suggest({ identifier: 'SuggestedImportIndex', file: __filename })
      ).to.deep.equal([
        {
          code: 'import SuggestedImportIndex from "../SuggestedImportIndex"',
        },
      ])

      expect(
        index.suggest({ identifier: 'Kind', file: __filename })
      ).to.deep.equal([
        {
          code: 'import { type Kind } from "../ASTTypes"',
        },
      ])
    })
    it(`bugs -- spBv1.0.js extension`, async function () {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new SuggestedImportIndex({
        projectRoot,
      })

      await index.declareModule(
        path.join(
          __dirname,
          '..',
          '..',
          'node_modules',
          '@jcoreio',
          'sparkplug-payload',
          'spBv1.0.js'
        ),
        parser.parse({
          code: `export function encodePayload() { }`,
        })
      )

      expect(
        index.suggest({
          identifier: 'encodePayload',
          file: __filename,
        })
      ).to.containSubset([
        {
          code: 'import { encodePayload } from "@jcoreio/sparkplug-payload/spBv1.0"',
        },
      ])
    })
    it(`tolerates nonexistent imports`, async function (): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new SuggestedImportIndex({
        projectRoot,
      })

      await index.declareModule(
        path.join(__dirname, '..', '~test.js'),
        parser.parse({
          code: `
          import glab from 'glab'
          import glomb from './glomb'
        `,
        })
      )

      expect(
        index.suggest({
          identifier: 'glab',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import glab from "glab"' }])

      expect(
        index.suggest({
          identifier: 'glomb',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import glomb from "../glomb"' }])
    })

    it(`removes previous imports`, async function (): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new SuggestedImportIndex({
        projectRoot,
      })

      await index.declareModule(
        path.join(__dirname, '..', '~test.js'),
        parser.parse({
          code: `
          import foo from 'foo'
          import baz from './baz'
        `,
        })
      )

      expect(
        index.suggest({
          identifier: 'foo',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import foo from "foo"' }])
      expect(
        index.suggest({
          identifier: 'baz',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import baz from "../baz"' }])

      await index.declareModule(
        path.join(__dirname, '..', '~test.js'),
        parser.parse({
          code: `
          import foo from 'bar'
          import baz from './qux'
        `,
        })
      )

      expect(
        index.suggest({
          identifier: 'foo',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import foo from "bar"' }])
      expect(
        index.suggest({
          identifier: 'baz',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import baz from "../qux"' }])
      expect(
        index.suggest({
          identifier: 'foo',
          file: __filename,
        })
      ).not.to.containSubset([{ code: 'import foo from "foo"' }])
      expect(
        index.suggest({
          identifier: 'baz',
          file: __filename,
        })
      ).not.to.containSubset([{ code: 'import baz from "../baz"' }])
    })
    it(`removes previous exports`, async function (): Promise<void> {
      const projectRoot = path.resolve(__dirname, '..', '..')
      const parser = new FlowParser()
      const index = new SuggestedImportIndex({
        projectRoot,
      })

      await index.declareModule(
        path.join(__dirname, '..', 'test.js'),
        parser.parse({
          code: `
          export default class Foo {}
          export const bar = 'baz'
        `,
        })
      )

      expect(
        index.suggest({
          identifier: 'Foo',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import Foo from "../test"' }])
      expect(
        index.suggest({
          identifier: 'bar',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import { bar } from "../test"' }])
      expect(
        index.suggest({
          identifier: 'test',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import test from "../test"' }])

      await index.declareModule(
        path.join(__dirname, '..', 'test.js'),
        parser.parse({
          code: `
          export default class Bar {}
          export const qux = 'baz'
        `,
        })
      )

      expect(
        index.suggest({
          identifier: 'test',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import test from "../test"' }])
      expect(
        index.suggest({
          identifier: 'Bar',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import Bar from "../test"' }])
      expect(
        index.suggest({
          identifier: 'qux',
          file: __filename,
        })
      ).to.containSubset([{ code: 'import { qux } from "../test"' }])
      expect(
        index.suggest({
          identifier: 'Foo',
          file: __filename,
        })
      ).not.to.containSubset([{ code: 'import Foo from "../test"' }])
      expect(
        index.suggest({
          identifier: 'bar',
          file: __filename,
        })
      ).not.to.containSubset([{ code: 'import { bar } from "../test"' }])
    })
  })
})
