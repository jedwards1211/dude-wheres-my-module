/**
 * @prettier
 * @flow
 */

export default function some<T>(
  iterable: Iterable<T>,
  predicate: T => boolean
): boolean {
  for (const element of iterable) {
    if (predicate(element)) return true
  }
  return false
}
