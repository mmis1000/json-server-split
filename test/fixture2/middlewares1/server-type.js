// hello.js
module.exports = (req, res, next) => {
  res.header('X-Potato-Baked-By', 'Intel')
  next()
}