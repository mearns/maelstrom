import {Queue} from 'queue-as-promised'
import {NoSuchRequestError, NoSuitableResourceError, IllegalResourceError, FailedToCreateRequestError} from './errors'
import {newIdSupplier} from './id-supplier'
import ExtrinsicPromise from 'extrinsic-promises'
import Promise from 'bluebird'

class Pool {
  constructor ({repo, queueFactory}) {
    this.resources = {}
    this.resourceIdSupplier = newIdSupplier()

    // Actual requests are stored in the repo, the stuff that needs to persist. This thing is
    // just the transient data related to it's status in the queue. It doesn't need to be restored
    // in the event of a shutdown, for instance.
    this.transientRequestData = {}
    this.repo = repo
    this.newQueue = queueFactory || (() => new Queue())
  }

  getResourceIds () {
    return Object.keys(this.resources)
  }

  getResourceCount () {
    return Object.keys(this.resources).length
  }

  serializeResourceProperties (resource) {
    try {
      return JSON.stringify(resource)
    } catch (e) {
      throw new IllegalResourceError()
    }
  }

  deserializeResourceProperties (resource) {
    return JSON.parse(resource)
  }

  addResource (properties) {
    const resourceId = this.resourceIdSupplier.get()
    this.resources[resourceId] = {
      properties: this.serializeResourceProperties(properties),
      queue: this.newQueue()
    }
    return Promise.resolve(resourceId)
  }

  getResource (resourceId) {
    return this.resources[resourceId]
  }

  getResourceProperties (resourceId) {
    return this.deserializeResourceProperties(this.getResource(resourceId).properties)
  }

  /**
   * Given a user request, return the list of resource IDs for known
   * resources that are suitable for the request.
   */
  getSuitableResourceIds (userRequest) {
    return Object.keys(this.resources)
  }

  requestResource (userRequest) {
    return Promise.method(this.repo.createRequest.bind(this.repo))(userRequest)
      .catch(error => {
        throw new FailedToCreateRequestError(error, `Failed to create request: ${error.message}`)
      })
      .then(requestId => {
        try {
          const resourceIds = this.getSuitableResourceIds(userRequest)
          if (resourceIds.length === 0) {
            throw new NoSuitableResourceError()
          }
          this.transientRequestData[requestId] = {
            pendingResources: resourceIds.length,
            waitingForResource: true,
            promiseToAcquire: new ExtrinsicPromise(),
            promiseToReleaseResource: new ExtrinsicPromise()
          }
          resourceIds.forEach(resourceId => this.addResourceReservation(requestId, resourceId))
          return requestId
        } catch (error) {
          return this.repo.requestFailed(requestId, error)
            .then(() => Promise.reject(error))
        }
      })
  }

  getTransientRequestData (requestId) {
    const requestData = this.transientRequestData[requestId]
    if (requestData) {
      return requestData
    }
    throw new NoSuchRequestError(requestId)
  }

  whenAcquired (requestId) {
    return this.getTransientRequestData(requestId).promiseToAcquire
  }

  addResourceReservation (requestId, resourceId) {
    const resource = this.getResource(resourceId)
    const requestData = this.getTransientRequestData(requestId)
    let decremented = false
    Promise.resolve(resource.queue.enqueue(
      () => {
        if (requestData.waitingForResource) {
          requestData.pendingResources -= 1
          decremented = true
          requestData.waitingForResource = false
          return Promise.resolve(this.repo.resourceAcquired(requestId, resourceId))
            .tapCatch(error => {
              return this.repo.requestFailed(requestId, error)
                .finally(() => requestData.promiseToAcquire.reject(error))
            })
            // signal to caller that resource is acquired (resolve the promise)
            .tap(() => requestData.promiseToAcquire.fulfill({requestId, resourceId}))
            // return to queue a promise that we can resolve when the request is complete.
            .then(() => requestData.promiseToRelease.hide())
        }
      }))
      .catch(error => {
        if (!decremented) {
          requestData.pendingResources -= 1
        }
        if (requestData.pendingResources === 0 && requestData.waitingForResource) {
          return Promise.resolve(this.repo.requestFailed(requestId, error))
            .finally(() => requestData.promiseToAcquire.reject(error))
        }
      })
  }

  release (requestId) {
    const requestData = this.getTransientRequestData(requestId)
    return Promise.resolve(this.repo.requestComplete(requestId))
      .finally(() => {
        requestData.promiseToReleaseResource.fulfill()  // release from queue
      })
  }
}

export function newResourcePool (options) {
  const pool = new Pool(options)
  return {
    requestResource: pool.requestResource.bind(pool),
    addResource: pool.addResource.bind(pool),
    getResourceProperties: pool.getResourceProperties.bind(pool),
    getResourceIds: pool.getResourceIds.bind(pool),
    getResourceCount: pool.getResourceCount.bind(pool),
    whenAcquired: pool.whenAcquired.bind(pool),
    release: pool.release.bind(pool)
  }
}
