import { existsSync, mkdirSync } from 'fs'
import { resolve as _resolve } from 'path'
import low from 'lowdb'
import { yellow } from 'chalk'
import SplitJSONAdapter from '@mmis1000/lowdb-split-json-adapter'

export default function (dirname: string) {
  return new Promise<low.LowdbSync<any>>((resolve, reject) => {
    if (dirname) {
      if (!existsSync(dirname)) {
        console.log(yellow(`  Oops, ${dirname} doesn't seem to exist`))
        console.log(yellow(`  Creating ${dirname} with some default data`))
        console.log()
        mkdirSync(dirname)
        // writeFileSync(dirname, JSON.stringify(example, null, 2))
      }

      resolve(low(new SplitJSONAdapter(dirname) as any) as any)
    } else {
      throw new Error(`Unsupported source ${dirname}`)
    }
  })
}
