// hello.js
export default (req: any, res: any, next: any) => {
  res.header('X-Imports-As', 'EsModule')
  next()
}