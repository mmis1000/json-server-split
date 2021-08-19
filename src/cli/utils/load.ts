import { existsSync, mkdirSync } from 'fs'
import { resolve as _resolve } from 'path'
import low from 'lowdb'
import { yellow } from 'chalk'
import SplitJSONAdapter from '@mmis1000/lowdb-split-json-adapter'

export default function load (dirname: string) {
  return new Promise<SplitJSONAdapter>((resolve, reject) => {
    if (dirname) {
      if (!existsSync(dirname)) {
        console.log(yellow(`  Oops, ${dirname} doesn't seem to exist`))
        console.log(yellow(`  Creating ${dirname} with some default data`))
        console.log()
        mkdirSync(dirname)
        // writeFileSync(dirname, JSON.stringify(example, null, 2))
      }

      resolve(new SplitJSONAdapter(dirname))
    } else {
      throw new Error(`Unsupported source ${dirname}`)
    }
  })
}
