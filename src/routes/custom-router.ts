import express from 'express'
import { inspect } from 'util'
import { RouteInfo } from '../interfaces'

export default (routers: RouteInfo[]) => {
  const router = express.Router()

  router.get('/__routers', (req, res) => {
    res.json(routers.map(i => ({ route: i.route, path: i.relativePath })))
  })

  for (let info of routers) {
    router.use(info.route, info.handler)
  }

  return router
}