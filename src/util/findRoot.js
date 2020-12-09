// @flow

import fs from 'fs'
import path from 'path'

const cache: Map<string, string | Error> = new Map()

function findRootHelper(p: string): string {
  if (fs.existsSync(path.join(p, 'package.json'))) {
    return p
  }
  const parent = path.dirname(p)
  if (!parent || parent === p)
    throw new Error('package.json not in any parent directories')
  return findRoot(parent)
}

export default function findRoot(p: string): string {
  const cached = cache.get(p)
  if (cached) {
    if (cached instanceof Error) throw cached
    return cached
  }

  try {
    const result = findRootHelper(p)
    cache.set(p, result)
    return result
  } catch (error) {
    cache.set(p, error)
    throw error
  }
}
