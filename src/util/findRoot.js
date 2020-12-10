// @flow

import fs from 'fs-extra'
import path from 'path'

const cache: Map<string, string | Error> = new Map()

function findRootSyncHelper(p: string): string {
  if (fs.existsSync(path.join(p, 'package.json'))) {
    return p
  }
  const parent = path.dirname(p)
  if (!parent || parent === p)
    throw new Error('package.json not in any parent directories')
  return findRootSync(parent)
}

export function findRootSync(p: string): string {
  const cached = cache.get(p)
  if (cached) {
    if (cached instanceof Error) throw cached
    return cached
  }

  try {
    const result = findRootSyncHelper(p)
    cache.set(p, result)
    return result
  } catch (error) {
    cache.set(p, error)
    throw error
  }
}

async function findRootHelper(p: string): Promise<string> {
  if (await fs.exists(path.join(p, 'package.json'))) {
    return p
  }
  const parent = path.dirname(p)
  if (!parent || parent === p)
    throw new Error('package.json not in any parent directories')
  return await findRoot(parent)
}

export async function findRoot(p: string): Promise<string> {
  const cached = cache.get(p)
  if (cached) {
    if (cached instanceof Error) throw cached
    return cached
  }

  try {
    const result = await findRootHelper(p)
    cache.set(p, result)
    return result
  } catch (error) {
    cache.set(p, error)
    throw error
  }
}
