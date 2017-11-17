import {newIdSupplier} from './id-supplier'
import {NoSuchRequestError,
  PoolAlreadyExistsError, NoSuchPoolError} from './errors'
import R from 'ramda'

const REQUEST_STATE_WAITING = 'waiting'
const REQUEST_STATE_ACQUIRED = 'resource-acquired'
const REQUEST_STATE_COMPLETE = 'complete'
const REQUEST_STATE_FAILED = 'failed'

class TransientRepo {
  constructor () {
    this.poolRepos = {}
  }

  createPoolRepo ({poolId}) {
    if (this.poolRepos[poolId]) {
      throw new PoolAlreadyExistsError(poolId)
    }
    this.poolRepos[poolId] = new TransientRequestRepo()
    return this.poolRepos[poolId]
  }

  getPoolRepo (poolId) {
    const poolRepo = this.poolRepos[poolId]
    if (!poolRepo) {
      throw new NoSuchPoolError(poolId)
    }
    return poolRepo
  }
}

class TransientRequestRepo {
  constructor () {
    this.requests = {}
    this.requestIdSupplier = newIdSupplier()
  }

  createRequest ({description = null} = {}) {
    const requestId = this.requestIdSupplier.get()
    this.requests[requestId] = {
      description: String(description),
      state: REQUEST_STATE_WAITING
    }
    return Promise.resolve(requestId)
  }

  getRequest (requestId) {
    const request = this.requests[requestId]
    if (!request) {
      return Promise.reject(new NoSuchRequestError(requestId))
    }
    return Promise.resolve(request)
  }

  getState (requestId) {
    return this.getRequest(requestId)
      .then(R.prop('state'))
  }

  getActiveResource (requestId) {
    return this.getRequest(requestId)
      .then(R.prop('acquiredResourceId'))
  }

  resourceAcquired (requestId, resourceId) {
    return this.getRequest(requestId)
      .then((request) => {
        request.state = REQUEST_STATE_ACQUIRED
        request.acquiredResourceId = resourceId
      })
  }

  requestComplete (requestId) {
    return this.getRequest(requestId)
      .then((request) => {
        request.state = REQUEST_STATE_COMPLETE
      })
  }

  requestFailed (requestId, error) {
    return this.getRequest(requestId)
      .then((request) => {
        request.state = REQUEST_STATE_FAILED
        request.error = error
      })
  }
}

export function newTransientRepo () {
  return new TransientRepo()
}
