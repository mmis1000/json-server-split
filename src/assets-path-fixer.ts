import { URL } from 'url'

type JSON = { [K: string]: JSON } | Array<JSON> | number | string | boolean | null

/**
 * Path example
 * ```
 * test.*.lol => { test: [{ lol: '/test' }]}
 * test.*.lol => { test: { aaa: { lol: '/test' }}}
 * *.res => { aaa: { res: '/test }}
 * *.res => [{ res: '/test }]
 * ```
 */
export const fixAssetsPath = (data: JSON, base: string, paths: string[]) => {
  const mappedPaths = paths.map(it => it.split(/\./g))

  const rewrite = (data: JSON, paths: Array<string>[]): JSON => {
    switch (typeof data) {
      case "boolean":
        return data
      case "number":
        return data
      case "string":
        if (paths.find(it => it.length === 0)) {
          // actual rewrite
          return new URL(
            // remove leading /
            data.replace(/^\/+/, ''),
            // append trailing /
            base.replace(/\/*$/, '/')
          ).toString()
        } else {
          return data
        }
      case "object":
        if (data === null) {
          return null
        }

        if (Array.isArray(data)) {
          return data.map((d, key) => {
            const newPaths = paths.filter(it => it[0] === '*' || it[0] === String(key)).map(it => it.slice(1))
            if (newPaths.length > 0) {
              return rewrite(d, newPaths)
            } else {
              return d
            }
          })
        } else {
          const keys = Object.keys(data)
          const newData: { [K: string]: JSON } = {}
          for (const key of keys) {
            const newPaths = paths.filter(it => it[0] === '*' || it[0] === String(key)).map(it => it.slice(1))
            if (newPaths.length > 0) {
              newData[key] = rewrite(data[key], newPaths)
            } else {
              newData[key] = data[key]
            }
          }
          return newData
        }
    }
  }

  return rewrite(data, mappedPaths)
}