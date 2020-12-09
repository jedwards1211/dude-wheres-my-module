// @flow

import resolve from 'resolve'
import findRoot from './findRoot'

const cache: Map<string, string> = new Map()

export default function resolveInDir(request: string, dir: string): string {
  const root = findRoot(dir)
  const cacheKey = JSON.stringify([request, root])
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const resolved = resolve.sync(request, { basedir: root })
  cache.set(cacheKey, resolved)
  return resolved
}
