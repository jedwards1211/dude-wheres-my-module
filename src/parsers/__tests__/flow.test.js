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
    it(`type parameter bounds`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        class Foo<T: Bar> {
        }
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`computed property type issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        type Foo = {[bar: Bar]: Baz}
      `)
      expect(found).to.have.lengthOf(2)
      expect(found[0].identifier).to.equal('Bar')
      expect(found[1].identifier).to.equal('Baz')
    })
    it(`tagged template literals`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = bar\`baz\`
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
    it(`function expression names`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = function bar() { }
      `)
      expect(found).to.have.lengthOf(0)
    })
    it(`function expression names`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = function bar() { }
      `)
      expect(found).to.have.lengthOf(0)
    })
    it(`destructuring renaming`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const {bar: baz} = {}
      `)
      expect(found).to.have.lengthOf(0)
    })
    it(`renamed export`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        export {foo as bar}
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('foo')
    })
    it(`undefined export`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        export {foo}
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('foo')
    })
    it(`export from`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        export {foo} from './foo'
        export {bar as baz} from './bar'
        export * as qux from './qux'
      `)
      expect(found).to.have.lengthOf(0)
    })
    it(`qualified type identifiers`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        type Foo = Bar.Baz
        type Qux = Foo.Bux.Baz
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`computed member expression`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const bar = {}
        const foo = bar[baz]
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('baz')
    })
    it(`lowercase JSX tag issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = <div />
        const bar = <Baz />
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Baz')
    })
    it(`function in JSX attribute issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = <div onClick={handleOnClick(2)} />
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('handleOnClick')
    })
    it(`JSXMemberExpression issue`, function() {
      const parser = new FlowParser()
      const found = parser.getUndefinedIdentifiers(`
        const foo = <MyContext.Provider />
      `)
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('MyContext')
    })
  })
})
