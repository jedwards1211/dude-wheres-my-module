import resolve from 'resolve'
import path from 'path'

const cache: Map<string, Map<string, string>> = new Map()

function getRootDir(file: string): string {
  while (file !== '/') {
    if (path.basename(file) === 'node_modules') return path.dirname(file)
    file = path.dirname(file)
  }
  return path.dirname(file)
}

export default function resolveInDir(request: string, dir: string): string {
  const forRequest = cache.get(request)
  if (!forRequest) {
    const resolved = resolve.sync(request, { basedir: dir })
    cache.set(request, new Map([[getRootDir(resolved), resolved]]))
    return resolved
  }
  let parentDir = dir
  do {
    const resolved = forRequest.get(parentDir)
    if (resolved) return resolved
    parentDir = path.dirname(parentDir)
  } while (parentDir && parentDir !== '/')

  const resolved = resolve.sync(request, { basedir: dir })
  forRequest.set(getRootDir(resolved), resolved)
  return resolved
}
