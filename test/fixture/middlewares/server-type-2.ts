// hello.js
export = (req: any, res: any, next: any) => {
  res.header('X-Ts-By', 'TsNode')
  next()
}