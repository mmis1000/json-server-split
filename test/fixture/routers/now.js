module.exports = function (req, res) {
  res.jsonp({
    time: new Date().toISOString(),
    random: Math.random()
  })
}