import { RequestHandler } from "express"

export default <RequestHandler>function (req, res) {
  res.jsonp({
    time: new Date().toISOString(),
    random: Math.random()
  })
}