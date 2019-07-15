/**
 * @prettier
 */

import { describe, it } from 'mocha'
import { expect } from 'chai'
import recast from 'recast'
import BabelParser from '../babel'
import path from 'path'

const testFile = path.join(__dirname, '__test.js')

describe(`BabelParser`, function() {
  describe(`getMode`, function() {
    it(`defaults to require`, function() {
      const parser = new BabelParser()
      expect(parser.getMode({ code: '' })).to.equal('require')
    })
    it(`returns import if any flow annotation is found`, function() {
      const parser = new BabelParser()
      expect(parser.getMode({ code: '// @flow' })).to.equal('import')
      expect(parser.getMode({ code: '/* @flow */' })).to.equal('import')
    })
    it(`returns import if any import statement is found`, function() {
      const parser = new BabelParser()
      expect(parser.getMode({ code: `import foo from 'foo'` })).to.equal(
        'import'
      )
    })
  })
  describe(`getUndefinedIdentifiers`, function() {
    it(`member call expression issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        process.stderr.write('test')
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`uninitialized declarator issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        let foo: Bar
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`shorthand syntax issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = {bar}
        const baz = {foo}
        const options = {cwd: foo}
      `,
        file: testFile,
      })
      expect(found.map(f => f.identifier)).to.deep.equal(['bar'])
    })
    it(`class property type issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        type Fonk = {}

        class Publisher {
          pubsub: PubSubEngine
          fonk: Fonk
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('PubSubEngine')
    })
    it(`JSX component issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const Foo = () => <Bar baz="qux" />
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`function type argument name issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo: ?(theme: Theme) => any = null
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Theme')
    })
    it(`computed property issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = {[bar]: 'baz'}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
    it(`type parameter bounds`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        class Foo<T: Bar> {
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`computed property type issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        type Foo = {[bar: Bar]: Baz}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(2)
      expect(found[0].identifier).to.equal('Bar')
      expect(found[1].identifier).to.equal('Baz')
    })
    it(`tagged template literals`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = bar\`baz\`
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('bar')
    })
    it(`function expression names`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = function bar() { }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`function expression names`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = function bar() { }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`destructuring renaming`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const {bar: baz} = {}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`renamed export`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        export {foo as bar}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('foo')
    })
    it(`undefined export`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        export {foo}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('foo')
    })
    it(`export from`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        export {foo} from './foo'
        export {bar as baz} from './bar'
        export * as qux from './qux'
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`qualified type identifiers`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        type Foo = Bar.Baz
        type Qux = Foo.Bux.Baz
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Bar')
    })
    it(`computed member expression`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const bar = {}
        const foo = bar[baz]
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('baz')
    })
    it(`lowercase JSX tag issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = <div />
        const bar = <Baz />
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('Baz')
    })
    it(`function in JSX attribute issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = <div onClick={handleOnClick(2)} />
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('handleOnClick')
    })
    it(`JSXMemberExpression issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = <MyContext.Provider />
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
      expect(found[0].identifier).to.equal('MyContext')
    })
    it(`rest props issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = ({variables: {bar, ...values}}) => {}
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`opaque type issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        export opaque type IdentifierName = string
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`ObjectMethod issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = {
          bar() {}
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`Computed ObjectMethod`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        const foo = {
          [bar]() {}
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
    })
    it(`ClassMethod issue`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        class Foo {
          bar() {}
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(0)
    })
    it(`Computed ClassMethod`, function() {
      const parser = new BabelParser()
      const found = parser.getUndefinedIdentifiers({
        code: `
        class Foo {
          [bar]() {}
        }
      `,
        file: testFile,
      })
      expect(found).to.have.lengthOf(1)
    })
  })
  describe(`parse`, function() {
    async function parse({ code }) {
      const parser = new BabelParser()
      return await parser.parse({ code, file: testFile })
    }

    it(`ignores shadowed require calls`, async function(): Promise<void> {
      const code = `
      function require() {}
      const foo = require('foo')
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([])
    })
    it(`converts require default to ImportDeclaration`, async function(): Promise<void> {
      const code = `
      const foo = require('foo')
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([`import foo from "foo";`])
    })
    it(`converts destructured require to ImportDeclaration`, async function(): Promise<void> {
      const code = `
      const {foo, bar: baz} = require('foo')
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([`import { foo, bar as baz } from "foo";`])
    })
    it(`converts indirect destructured require to ImportDeclaration`, async function(): Promise<void> {
      const code = `
      const blah = require('foo')
      const {foo, bar: baz} = blah
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([
        `import blah from "foo";`,
        `import { foo, bar as baz } from "foo";`,
      ])
    })
    it(`converts property access on require variable to ImportDeclaration`, async function(): Promise<void> {
      const code = `
      const blah = require('foo')
      blah.foo()
      blah.bar()
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([
        `import blah from "foo";`,
        `import { foo } from "foo";`,
        `import { bar } from "foo";`,
      ])
    })
    it(`converts direct property access on require to ImportDeclaration`, async function(): Promise<void> {
      const code = `
      require('foo').bar
      `
      const decls = [...(await parse({ code }))].map(
        ast => recast.print(ast).code
      )
      expect(decls).to.deep.equal([`import { bar } from "foo";`])
    })
    it(`doesn't error on uninitialized declarators`, async function(): Promise<void> {
      const code = `
      let foo: ?Bar
      `
      await parse({ code })
    })
  })
})
