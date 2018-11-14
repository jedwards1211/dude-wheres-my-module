/**
 * @flow
 * @prettier
 */

export default function isConfigFile(file: string): boolean {
  return /\.dwmm\.js$/.test(file)
}
