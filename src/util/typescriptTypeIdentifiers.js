// @flow

import builtinClasses from './builtinClasses'

const typescriptBuiltinIdentifiers: Set<string> = new Set([
  ...builtinClasses,
  'Partial',
  'Readonly',
  'Record',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ConstructorParameters',
  'ReturnType',
  'InstanceType',
  'Required',
  'ThisParameterType',
  'OmitThisParameter',
  'ThisType',
])

export default typescriptBuiltinIdentifiers
