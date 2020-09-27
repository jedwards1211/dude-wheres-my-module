/**
 * @prettier
 * @flow
 */

export default function lazy<T>(
  compute: () => T
): {
  (): T,
  clear: () => void,
} {
  let result: ?[T] = null
  function lazified(): T {
    return (result || (result = [compute.apply(this, arguments)]))[0]
  }
  lazified.clear = () => {
    result = null
  }
  return lazified
}
