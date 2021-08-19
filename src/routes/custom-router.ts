import express from 'express'
import { inspect } from 'util'

export interface RouteInfo {
  route: string
  relativePath: string
  handler: express.RequestHandler
}

export default (routers: RouteInfo[]) => {
  const router = express.Router()

  router.get('/__routers', (req, res) => {
    res.json(routers.map(i => ({ route: i.route, path: i.relativePath })))
  })

  for (let info of routers) {
    try {
      router.use(info.route, info.handler)
    } catch (err) {
      console.error(inspect(err))
      process.exit(1)
    }
  }

  return router
}