// @flow

/* eslint-disable no-console */

import semver from 'semver'

if (semver.satisfies(process.version, '>=12.0.0 <12.3.0')) {
  console.error(
    `Node >=12.0.0 <12.3.0 isn't supported due to a bug in require.resolve.
Please upgrade to Node 12.3.0 or greater.
For more information, see https://github.com/nodejs/node/issues/29139`
  )
  process.exit(12)
}
