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

I'm using it with a cobbled-together [`atom-morpher`](https://github.com/suchipi/atom-morpher)
transform to run it in Atom. Hopefully I'll make a more first-class Atom
or VSCode plugin soon.

# Table of Contents

<!-- toc -->

- [Features](#features)
- [Limitations/Known Issues](#limitationsknown-issues)
- [Installation](#installation)
- [CLI Commands](#cli-commands)
  - [`dude wheres [--file ]`](#dude-wheres----file-)
  - [`dude suggest`](#dude-suggest-)
  - [`dude stop`](#dude-stop)
  - [`dude stahp`/`dude kill`](#dude-stahpdude-kill)
- [Node.js API](#nodejs-api)
  - [`new Client(projectRoot: string)`](#new-clientprojectroot-string)
  - [`Client.suggest(options)`](#clientsuggestoptions)
  - [`Client.wheres(options)`](#clientwheresoptions)
  - [`Client.on('starting', () => any)`](#clientonstarting---any)
  - [`Client.on('progress', ({ completed: number, total: number }) => any)`](#clientonprogress--completed-number-total-number---any)
  - [`Client.on('ready', () => any)`](#clientonready---any)

<!-- tocstop -->

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

# Limitations/Known Issues

This project is getting pretty solid, but there are still a few issues.

- There are still a few cases where `dude-wheres-my-module` mistakenly thinks
  an identifier is unbound, for example `T` in the following statement:
  ```
  async function withStatus<T>(fn: () => Promise<T>): Promise<T> {
  ```
- There are a few cases where obsolete suggested imports
  stick around after you delete them from the file `dude-wheres-my-module` got them from, or delete that file entirely.
- `dude-wheres-my-module` doesn't automatically try to figure out what imports are available from packages in your `node_modules` yet. But the good news is that if you've imported something once in one file, it will be available in suggestions for other files. You can also manually configure preferred imports from packages in `node_modules`

# Installation

```sh
npm install --global dude-wheres-my-module
```

# CLI Commands

The CLI isn't intended to be the primary way you get import suggestions, it's just for test-driving the server or telling it to shut down.

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

### `options`

##### `file` (`string`, _required_)

The file to suggest import paths relative to.

##### `code` (`string`, _optional_)

If given, will suggest imports for any undeclared identifiers in this code.

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
