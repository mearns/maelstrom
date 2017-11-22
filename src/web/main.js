import express from 'express'
import * as apiRouter from './routers/api-router'
import {newPoolCollection} from '../pool-collection'
import {newTransientRepo} from '../repo'
import * as URLs from './urls'
import Promise from 'bluebird'

const PORT = 8080
const HOST = 'localhost'

export function main () {
  createServer()
    .then(startServer)
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

  return Promise.join(
    poolCollection.createPool({poolId: 'databases'})
      .then(pool => Promise.join(
        pool.addResource({name: 'db-A', server: 'server1', dbName: 'test01'}),
        pool.addResource({name: 'db-B', server: 'server1', dbName: 'test02'}),
        pool.addResource({name: 'db-C', server: 'server1', dbName: 'test03'}),
        pool.addResource({name: 'db-D', server: 'server2', dbName: 'test01'})
      )),
    poolCollection.createPool({poolId: 'vms'})
      .then(pool => Promise.join(
        pool.addResource({name: 'vm-1', ram: 4096, nullValue: null}),
        pool.addResource({name: 'vm-2', ram: 4096}),
        pool.addResource({name: 'vm-3', ram: 2048})
      ))
  ).then(() => Promise.join(
    addApiRouter(app, {poolCollection}),
    addStaticRouter(app),
    () => app
  ))
}

function addApiRouter (app, options) {
  const router = express.Router()
  return apiRouter.configure(router, options)
    .then(() => app.use(URLs.API_URL, router))
}

function addStaticRouter (app) {
  app.use('/static/', express.static('./dist/static/'))
}
