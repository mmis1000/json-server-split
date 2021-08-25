export = function (req: import('express').Request, res: import('express').Response) {
  res.jsonp({
    time: new Date().toISOString(),
    random: Math.random()
  })
}