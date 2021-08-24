// hello.js
module.exports = (req, res, next) => {
  res.header('X-Powered-By', 'Potato')
  next()
}