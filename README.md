# dude-wheres-my-module

[![CircleCI](https://circleci.com/gh/jedwards1211/dude-wheres-my-module.svg?style=svg)](https://circleci.com/gh/jedwards1211/dude-wheres-my-module)
[![Coverage Status](https://codecov.io/gh/jedwards1211/dude-wheres-my-module/branch/master/graph/badge.svg)](https://codecov.io/gh/jedwards1211/dude-wheres-my-module)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![npm version](https://badge.fury.io/js/dude-wheres-my-module.svg)](https://badge.fury.io/js/dude-wheres-my-module)

### JavaScript/Flow suggested import server

As far as I can tell this is currently the only tool that can write not just
ordinary JS import and require statements but also Flow type import statements
for you too.

I've created [Atom](https://atom.io/packages/import-it) and [VSCode](https://marketplace.visualstudio.com/items?itemName=vscode-dude-wheres-my-module.vscode-dude-wheres-my-module) extensions for using this,
you probably won't want to use this package directly unless you're creating an extension for another IDE.

# Table of Contents

<!-- toc -->

- [Features](#features)
- [Limitations/Known Issues](#limitationsknown-issues)
- [Installation](#installation)
- [CLI Commands](#cli-commands)
  - [`dude wheres [--file ]`](#dude-wheres----file-)
  - [`dude suggest`](#dude-suggest-)
  - [`dude log [-f [tail options]]`](#dude-log--f-tail-options)
  - [`dude errors`](#dude-errors)
  - [`dude stop`](#dude-stop)
  - [`dude stahp`/`dude kill`](#dude-stahpdude-kill)
- [Node.js API](#nodejs-api)
  - [`new Client(projectRoot: string)`](#new-clientprojectroot-string)
  - [`Client.suggest(options)`](#clientsuggestoptions)
  - [`Client.wheres(options)`](#clientwheresoptions)
  - [`Client.on('starting', () => any)`](#clientonstarting---any)
  - [`Client.on('progress', ({ completed: number, total: number }) => any)`](#clientonprogress--completed-number-total-number---any)
  - [`Client.on('ready', () => any)`](#clientonready---any)
- [Configuration](#configuration)
  - [Config file API](#config-file-api)
  - [Config file example](#config-file-example)
- [Merging suggested imports into the code](#merging-suggested-imports-into-the-code)

<!-- tocstop -->

# Why other tools are lame

- AFAICT VSCode can't even suggest default or namespace imports.
- If you have `import {foo as bar} from 'foo'` in one file, VSCode/WebStorm won't suggest this for `bar` in another file.
- And of course, VSCode has no support for Flow `import type` and `import {type ...}`

# Where `dude-where-my-module` currently lags behind

The main thing is it doesn't currently scan exports in your `dependencies`/`flow-typed`/`@types` etc.
But once you have `import chalk from 'chalk'` in your code, it can suggest that for `chalk` in other files.

# Features

- Server that watches/indexes your import and require statements in the
  background
- Node.js Client to request import suggestions from the server
- CLI for test driving/stopping the server
- Relies on the Babel config in your project to parse your code
- Can suggest imports for:
  - native packages
  - identifiers exported from your code
  - identifiers imported by your code
  - custom preferred imports you define in dotfiles
- Supports `require` statements
- Supports `import` statements
- Supports Flow `import type` and `import {type ...}` statements

# Other Limitations/Known Issues

This project is getting pretty solid, but there are still a few issues.

- `dude-wheres-my-module` doesn't automatically try to figure out what imports are available from packages in your `node_modules` yet. But the good news is that if you've imported something once in one file, it will be available in suggestions for other files. You can also manually configure preferred imports from packages in `node_modules`
- There are a few cases where obsolete suggested imports
  stick around after you delete them from the file `dude-wheres-my-module` got them from, or delete that file entirely.
- It can't currently use Flow type information to rule out invalid suggestions (or decide that the way you're using a built-in idea identifier seems to indicate you meant to import something)

# Installation

```sh
npm install --global dude-wheres-my-module
```

# CLI Commands

The CLI isn't intended to be the primary way you get import suggestions, it's just for test-driving the server, debugging errors, or telling it to shut down.

All commands will automatically start a server for the
current project directory if one isn't already running
(except for commands that stop the server, of course).

On a large project the server might take awhile to boot
up and parse all of your code, but it will show you its
progress as it starts up!

## `dude wheres <identifier> [--file <filename>]`

Suggests `import` or `require` statements for a given identifier. You can optionally specify a filename to
import relative to.

### Example

Assuming both of these imports are found in your project
code or in custom preferred imports:

```
$ dude wheres pick
import { pick } from "lodash/fp"
import { pick } from "lodash"
```

## `dude suggest <filename>`

Suggests imports for all undeclared identifiers in a file.

### Example

```
$ dude suggest ListWithOneStatusItem.js
React (7:12)   children: React.Node,
  import * as React from "react"
ListItem (8:46)   ListItemProps?: ?React.ElementConfig<typeof ListItem>,
  import ListItem from "@material-ui/core/ListItem"
ListItemText (9:50)   ListItemTextProps?: ?React.ElementConfig<typeof ListItemText>,
  import ListItemText from "@material-ui/core/ListItemText"
List (18:3)   <List {...props}>
  import List from "@material-ui/core/List"
  import List from "@material-ui/icons/List"
```

##### `ListWithOneStatusItem.js`

```js
/**
 * @flow
 * @prettier
 */

export type Props = {
  children: React.Node,
  ListItemProps?: ?React.ElementConfig<typeof ListItem>,
  ListItemTextProps?: ?React.ElementConfig<typeof ListItemText>,
}

const ListWithOneStatusItem = ({
  children,
  ListItemProps,
  ListItemTextProps,
  ...props
}: Props): React.Node => (
  <List {...props}>
    <ListItem {...ListItemProps}>
      <ListItemText {...ListItemTextProps}>{children}</ListItemText>
    </ListItem>
  </List>
)

export default ListWithOneStatusItem
```

## `dude log [-f [tail options]]`

Print the server log file. With `-f`, it will `tail` the file.

## `dude errors`

Print out any error messages found in the server log file.

## `dude stop`

Stops the server gracefully.

## `dude stahp`/`dude kill`

Stops the server forcefully.

# Node.js API

```js
import Client from 'dude-wheres-my-module/Client'
```

## `new Client(projectRoot: string)`

Creates a client for the project in the `projectRoot`
directory (you can pass a subdirectory or file, and it
will automatically find the actual project root directory)

## `Client.suggest(options)`

Suggests `import` or `require` statements for all undeclared identifiers in a file.

### `options`

##### `file` (`string`, _required_)

The file to suggest import paths relative to.

##### `code` (`string`, _optional_)

The code to suggest imports for. If not given, the contents of `file` will be
used.

### Returns (`Promise<SuggestedImportsResult>`)

Each key in `SuggestedImportsResult` is an identifier,
and the corresponding value is an object with the following properties:

- `identifier: string` - the identifier
- `start: {line: number, column: number}` - the location of the start of the identifier in the file
- `end: {line: number, column: number}` the location of the start of the identifier in the file
- `context: string` - the line of the file on which the identifier appears
- `kind?: 'value' | 'type'` - whether the identifier appears in a value or type position
- `suggested` - an array of suggested imports, each having the following properties:
  - `code: string` - the `import` or `require` statement code
  - `ast` - the AST of the `import` or `require` statement

## `Client.wheres(options)`

Suggests `import` or `require` statements for a given identifier. You can optionally specify a filename to
import relative to.

### `options`

##### `identifier` (`string`, _optional_)

The identifier to suggest imports for.

##### `file` (`string`, _optional_)

The file to suggest import paths relative to.

### Returns (`Promise<Array<SuggestedImportResult>>`)

Each `SuggestedImportResult` has the following properties:

- `code: string` - the `import` statement code

## `Client.on('starting', () => any)`

This event is emitted when the client has started a new server process.

## `Client.on('progress', ({ completed: number, total: number }) => any)`

This event is emitted when the server parses a file, and includes the `total`
number of files it has discovered to parse, and the number of files it has
`completed` parsing.

## `Client.on('ready', () => any)`

This event is emitted when the server has finished starting up.

# Configuration

`dude-where-my-module` looks for `.dude-wheres-my-module.js` files in your
project directory and subdirectories. If found, it will load configuration
from them.

The server will hot-reload a file's configuration whenever you save changes to it.

## Config file API

The config file's `module.exports` must be a function that
returns a config object (or a `Promise` that resolves to a config object).
The following properties on the config object are supported:

### `preferredImports: Array<string>`

An array of code containing `import` statements you would like to come first
in suggested import lists.

## Config file example

This is the config file I use in one of my main projects. It adds submodules
from `lodash`, `@material-ui/core`, `@material-ui/icons`, and many more packages
to the preferred imports.

```js
/**
 * @prettier
 */

module.exports = async function configure() {
  const path = require('path')
  const { promisify } = require('es6-promisify')
  const glob = promisify(require('glob'))

  const nodeModulesDir = path.join(__dirname, 'node_modules')

  function assumeDefaultImports(files, options = {}) {
    const transformIdentifier = options.transformIdentifier || ((id) => id)
    const result = []
    files.forEach((file) => {
      if (/index\.js$/.test(file)) file = path.dirname(file)
      file = file.replace(/\.js$/, '')
      const identifier = path.basename(file)
      if (identifier[0] === '_' || /[^a-zA-Z0-9_]/.test(identifier)) return
      result.push(
        `import ${transformIdentifier(identifier, {
          file,
        })} from '${path.relative(nodeModulesDir, file)}'`
      )
    })
    return result
  }

  function assumeNamedImports(files) {
    const result = []
    files.forEach((file) => {
      if (/index\.js$/.test(file)) file = path.dirname(file)
      file = file.replace(/\.js$/, '')
      const identifier = path.basename(file)
      if (/^_|[^a-zA-Z0-9_]|^function$/.test(identifier)) return
      result.push(
        `import { ${identifier} } from '${path
          .relative(nodeModulesDir, path.dirname(file))
          .replace(/^\.\//, '')}'`
      )
    })
    return result
  }

  async function globNodeModules(pattern) {
    const files = await glob(path.join(nodeModulesDir, pattern))
    return assumeDefaultImports(files)
  }

  const preferredImports = [
    `
import _ from 'lodash'
import gql from 'graphql-tag'
import Sequelize, {Model, Association, type Transaction, type QueryGenerator, type FindOptions, type WhereOptions} from 'sequelize'
import {Query, Mutation, type QueryRenderProps, type MutationFunction} from 'react-apollo'
import Route from 'react-router-parsed/Route'
import {Link, NavLink, type Match, type RouterHistory, type Location} from 'react-router-dom'
import {createSelector, createStructuredSelector} from 'reselect'
import {connect, bindActionCreators} from 'react-redux'
import {compose} from 'redux'
import * as graphql from 'graphql'
import * as React from 'react'
import {reify} from 'flow-runtime'
import type {Type} from 'flow-runtime'
import classNames from 'classnames'
import requireEnv from '@jcoreio/require-env'
import path from 'path'
import fs from 'fs-extra'
import promisify from 'es6-promisify'
import BreakpointMedia from 'react-media-material-ui/BreakpointMedia'
import {type FormProps, type FieldProps, type FieldArrayProps} from 'redux-form'
import {describe, it, before, after, beforeEach, afterEach} from 'mocha'
import {expect} from 'chai'
    `,
  ]

  preferredImports.push(
    ...assumeNamedImports(
      await glob(path.join(nodeModulesDir, 'lodash/fp/*.js'))
    )
  )

  for (let pattern of [
    'redux-form/es/*.js',
    'redux-form-material-ui/es/*.js',
  ]) {
    preferredImports.push(...(await globNodeModules(pattern)))
  }
  preferredImports.push(
    ...assumeDefaultImports(
      await glob(path.join(nodeModulesDir, '@material-ui/core/**/index.js'), {
        ignore: [path.join(nodeModulesDir, '@material-ui/core/es/**')],
      })
    )
  )
  preferredImports.push(
    ...assumeDefaultImports(
      await glob(path.join(nodeModulesDir, '@material-ui/icons/*.js')),
      { transformIdentifier: (identifier) => `${identifier}Icon` }
    )
  )
  preferredImports.push(
    ...assumeDefaultImports(
      await glob(path.join(nodeModulesDir, '@material-ui/icons/*.js'))
    )
  )

  return {
    preferredImports,
  }
}
```

# Merging suggested imports into the code

If you're interested in writing an IDE plugin that uses `dude-wheres-my-module`,
I'd recommend using [`jscodeshift-add-imports`](https://github.com/jedwards1211/jscodeshift-add-imports#readme)
to merge the suggested imports into the the code.
