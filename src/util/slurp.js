/**
 * @prettier
 * @flow
 */

export default async function slurp<T>(
  iterable: AsyncIterable<T>
): Promise<T[]> {
  const result: T[] = []
  for await (const element of iterable) result.push(element)
  return result
}
