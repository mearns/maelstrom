import {PoolAlreadyExistsError} from '../../errors'
import express from 'express'
import HttpStatusCodes from 'http-status-codes'
import Promise from 'bluebird'

export function configure (app, options) {
  addV1Router(app, options)
}

function addV1Router (app, options) {
  const router = express.Router()
  configureV1Router(router, options)
  app.use('/v1/', router)
}

function getPoolHref (poolId) {
  return `/api/v1/pools/${poolId}`
}

function getPoolResourceHref (poolId, resourceId) {
  return `/api/v1/pools/${poolId}/resources/${resourceId}`
}

function configureV1Router (app, {poolCollection}) {
  app.get('/pools', (request, response) => {
    const poolsInfo = poolCollection.getPoolIds().reduce((obj, poolId) => {
      const pool = poolCollection.getPool(poolId)
      obj[poolId] = {
        id: poolId,
        href: getPoolHref(poolId),
        resourceCount: pool.getResourceCount()
      }
      return obj
    }, {})

    response
      .status(HttpStatusCodes.OK)
      .format({
        json: () => response.json(poolsInfo),
        default: () => response.json(poolsInfo)
      })
  })

  app.use('/pools/:poolId', (request, response, next) => {
    request.poolId = request.params.poolId
    next()
  })

  app.put('/pools/:poolId', (request, response) => {
    return Promise.resolve(poolCollection.createPool({poolId: request.poolId}))
      .then(() => {
        response
          .status(HttpStatusCodes.CREATED)
          .send('') // TODO: Send the same as on get.
      })
      .catch(PoolAlreadyExistsError, () => {
        response
          .status(HttpStatusCodes.CONFLICT)
          .type('text/plain')
          .send('Pool already exists')
      })
  })

  const poolsRouter = express.Router()
  configurePoolsRouter(poolsRouter, {poolCollection})
  app.use('/pools/:poolId', poolsRouter)
}

function configurePoolsRouter (app, {poolCollection}) {
  app.get('/', (request, response) => {
    if (poolCollection.hasPool(request.poolId)) {
      const pool = poolCollection.getPool(request.poolId)
      const resourcesInfo = pool.getResourceIds().reduce((obj, resourceId) => {
        obj[resourceId] = {
          id: resourceId,
          href: getPoolResourceHref(request.poolId, resourceId)
        }
        return obj
      }, {})
      const poolInfo = {
        id: request.poolId,
        href: getPoolHref(request.poolId),
        resources: resourcesInfo
      }
      response
        .status(HttpStatusCodes.OK)
        .format({
          json: () => response.json(poolInfo),
          default: () => response.json(poolInfo)
        })
    } else {
      response
        .status(HttpStatusCodes.NOT_FOUND)
        .type('text/plain')
        .send('No such pool')
    }
  })
}
