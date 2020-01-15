// @flow

import builtinClasses from './builtinClasses'

const builtinIdentifiers: Set<string> = new Set([
  ...builtinClasses,
  '__dirname',
  '__filename',
  'parseFloat',
  'parseInt',
  'Infinity',
  'NaN',
  'undefined',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'unescape',
  'eval',
  'isFinite',
  'isNaN',
  'global',
  'process',
  'clearImmediate',
  'clearInterval',
  'clearTimeout',
  'setImmediate',
  'setInterval',
  'setTimeout',
  'module',
  'require',
  'console',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'unescape',
  'eval',
  'isFinite',
  'isNaN',
  'webkitRTCPeerConnection',
  'webkitMediaStream',
  'window',
  'document',
  'navigator',
  'alert',
  'confirm',
  'prompt',
  'print',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'getComputedStyle',
  'fetch',
  'btoa',
  'atob',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'createImageBitmap',
  'crypto',
  'indexedDB',
  'sessionStorage',
  'localStorage',
])

export default builtinIdentifiers
