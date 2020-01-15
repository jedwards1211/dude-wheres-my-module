// @flow

import builtinClasses from './builtinClasses'

const flowTypeIdentifiers: Set<string> = new Set([
  ...builtinClasses,
  '$Keys',
  '$Values',
  '$ReadOnly',
  '$Exact',
  '$Diff',
  '$Rest',
  '$PropertyType',
  '$ElementType',
  '$NonMaybeType',
  '$ObjMap',
  '$TupleMap',
  '$Call',
  'Iterable',
  'Iterator',
  'AsyncIterable',
  'AsyncIterator',
  'Class',
  '$Shape',
  '$Supertype',
  '$Subtype',
])

export default flowTypeIdentifiers
