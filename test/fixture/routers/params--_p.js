module.exports = function (req, res) {
  res.jsonp({
    param: req.params.p,
    param2: "AAABAB"
  })
}