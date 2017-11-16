import express from 'express'
import * as apiRouter from './routers/api-router'
import {newPoolCollection} from '../pool-collection'
import {newTransientRepo} from '../repo'

const PORT = 8080
const HOST = 'localhost'

export function main () {
  startServer(createServer())
}

function startServer (app) {
  app.listen(PORT, HOST, (error) => {
    if (error) {
      throw error
    }
    console.log(`Listening on ${HOST}:${PORT}...`)
  })
}

function createServer () {
  const app = express()

  const repo = newTransientRepo()
  const poolCollection = newPoolCollection({repo})

  addApiRouter(app, {poolCollection})
  addStaticRouter(app)

  return app
}

function addApiRouter (app, options) {
  const router = express.Router()
  apiRouter.configure(router, options)
  app.use('/api/', router)
}

function addStaticRouter (app) {
  app.use('/static/', express.static('./dist/static/'))
}
