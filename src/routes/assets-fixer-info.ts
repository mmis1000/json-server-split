import express from 'express'
export default (data: any) => {
  const router = express.Router()

  router.get('/__assets-fixer', (req, res) => {
    res.json(data)
  })

  return router
}