const result = {}
for (var key in process.binding('natives')) {
  if (/^_|\/|^sys$/.test(key)) continue
  try {
    result[key] = Object.keys(require(key))
  } catch (error) {
    // ignore
  }
}
console.log(JSON.stringify(result)) // eslint-disable-line no-console
