/**
 * @flow
 * @prettier
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'

import FlowParser from '../flow'

describe(`FlowParser`, function() {
  describe(`getUndefinedIdentifiers`, function() {
    it(`shorthand syntax issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = {bar}
        const baz = {foo}
        const options = {cwd: foo}
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
    it(`class property type issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        type Fonk = {}

        class Publisher {
          pubsub: PubSubEngine
          fonk: Fonk
        }
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('PubSubEngine')
    })
    it(`JSX component issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const Foo = () => <Bar baz="qux" />
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`function type argument name issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo: ?(theme: Theme) => any
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Theme')
    })
    it(`computed property issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = {[bar]: 'baz'}
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
  })
})
