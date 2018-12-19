/**
 * @flow
 * @prettier
 */

export default function isConfigFile(file: string): boolean {
  return /\.dude-wheres-my-module\.js$/.test(file)
}
