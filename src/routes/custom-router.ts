import express from 'express'
import { readdirSync } from 'fs'
import { join, resolve } from 'path'
import { gray } from 'chalk'
import { inspect } from 'util'
import { JS } from '../cli/utils/is'

export default (routers: string) => {
  console.log()
  console.log(gray('  Loading routers from ', routers))

  const router = express.Router()

  const files = readdirSync(routers)
    .filter(JS)

  const infos = files.map(s => {
    const route = '/' + s.replace(/\.js$/, '').split(/--/g).map(s => s.replace(/^_/, ':')).join('/')
    const relativePath = join(routers, s)
    const scriptPath = require.resolve(resolve(relativePath))
    return {
      route,
      relativePath,
      scriptPath
    }
  })

  router.get('/__routers', (req, res) => {
    res.json(infos.map(i => ({ route: i.route, path: i.relativePath })))
  })

  for (let info of infos) {
    try {
      delete require.cache[info.scriptPath]
      const required = require(info.scriptPath)
      console.log(gray(`  Adding route ${info.route} from ${info.relativePath}`))
      router.use(info.route, required)
    } catch (err) {
      console.error(`Failed to require route file ${info.scriptPath}`)
      console.error(inspect(err))
      process.exit(1)
    }
  }

  console.log(gray(`  Done`))

  return router
}