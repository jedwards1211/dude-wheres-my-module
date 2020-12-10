// @flow

import _resolve from 'resolve'
import { findRootSync, findRoot } from './findRoot'
import { promisify } from 'util'

const resolve = promisify(_resolve)

const cache: Map<string, string> = new Map()
const asyncCache: Map<string, Promise<string>> = new Map()

export function resolveInDirSync(request: string, dir: string): string {
  const root = findRootSync(dir)
  const cacheKey = JSON.stringify([request, root])
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const resolved = _resolve.sync(request, { basedir: root })
  cache.set(cacheKey, resolved)
  asyncCache.set(cacheKey, Promise.resolve(resolved))
  return resolved
}

export async function resolveInDir(
  request: string,
  dir: string
): Promise<string> {
  const root = await findRoot(dir)
  const cacheKey = JSON.stringify([request, root])
  const cached = asyncCache.get(cacheKey)
  if (cached) return await cached

  const promise = resolve(request, { basedir: root })
  asyncCache.set(cacheKey, promise)
  promise.then(resolved => cache.set(cacheKey, resolved))
  return await promise
}
