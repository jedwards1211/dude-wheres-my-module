/**
 * @prettier
 * @flow
 */

export type LazyFn<T> = {
  (): T,
  clear: () => void,
}

export default function lazy<T>(compute: () => T): LazyFn<T> {
  let result: ?[T] = null
  function lazified(): T {
    return (result || (result = [compute.apply(this, arguments)]))[0]
  }
  lazified.clear = () => {
    result = null
  }
  return lazified
}
