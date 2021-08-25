export {
  FILE,
  JS,
}

function FILE(s: string) {
  return !URL(s) && /\.json$/.test(s)
}

function JS(s: string) {
  return !URL(s) && /\.[jt]s$/.test(s) && !/\.d\.ts$/.test(s)
}

function URL(s: string) {
  return /^(http|https):/.test(s)
}