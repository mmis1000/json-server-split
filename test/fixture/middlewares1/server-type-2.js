// hello.js
module.exports = (req, res, next) => {
  res.header('X-Cookie-Baked-By', 'Grandma')
  next()
}