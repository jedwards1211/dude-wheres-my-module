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
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
  })
})
