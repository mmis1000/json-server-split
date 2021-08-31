import { resolve, join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
export default (filePath: string) => {
  const fullPath = resolve(filePath)
  const [,dirname, filename] = (/^(.+[\\\/])([^\\\/]+)$/).exec(fullPath)!

  if (!/\.json$/.test(filename)) {
    console.error(`${filename} did not end with .json`)
    process.exit(1)
  }

  const data = JSON.parse(readFileSync(fullPath, 'utf-8'))
  // validate the keys

  const invalidKeys: string[] = []
  for (const key of Object.keys(data)) {
    if (/[\\\/:\*\?"<>\|]/.test(key)) {
      invalidKeys.push(key)
    }
  }

  if (invalidKeys.length > 0) {
    console.error(`input contains keys that are invalid for filename: ${invalidKeys.map(i => JSON.stringify(i)).join(', ')}`)
    process.exit(1)
  }

  const bareName = filename.replace(/\.json$/, '')
  const outputTarget = dirname + bareName

  if (existsSync(outputTarget)) {
    console.error(`output target ${outputTarget} already exists`)
    process.exit(1)
  }

  mkdirSync(outputTarget)

  for (const key of Object.keys(data)) {
    writeFileSync(join(outputTarget, key + '.json'), JSON.stringify(data[key], undefined, 2))
  }

  console.log(`Converted db outputted at ${outputTarget}`)

  let typedef = `interface Db {
`

  for (let key of Object.keys(data)) {
    if (!/^[a-zA-Z0-9_]$/.test(key)) {
      typedef += `  ${JSON.stringify(key)}: typeof import(${JSON.stringify( `./${bareName}/${key}.json`)})\n`
    } else {
      typedef += `  ${key}: typeof import(${JSON.stringify( `./${bareName}/${key}.json`)})\n`
    }
  }

  typedef += `}

export default Db
`
  writeFileSync(join(dirname, bareName + '.d.ts'), typedef)
}