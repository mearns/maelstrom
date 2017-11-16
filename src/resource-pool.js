import {Queue} from 'task-queue'
import {isEmpty} from 'ramda'
import {NoSuitableResourceError, FailedToObtainAnyResourcesError, IllegalResourceError, FailedToCreateRequestError} from './errors'
import Promise from 'bluebird'
import {newIdSupplier} from './id-supplier'

class Pool {
  constructor ({repo, queueFactory}) {
    this.resources = {}
    this.resourceIdSupplier = newIdSupplier()
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
    return resourceId
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

  /**
   * Create a new request for a resource matching the specified `userRequest`.
   * Once the resource is available, the given `onAvailable` function will be
   * called with the resource ID for the allocated resource. Return from
   * `onAvailable` when you're done with the resource so it can be returned
   * to the pool. Or, if you have asynchronous work to do with the resource,
   * return a promise that doesn't settle when you're done with the resource.
   *
   * This function will return a promise which settles according to the given
   * `onAvailable` function. It will also reject if an error occurs requesting
   * the resource, e.g., if there are no matching resources. By the time the
   * returned promise settles, either way, the resource has been freed back
   * into the pool.
   */
  requestResource (userRequest, onAvailable) {
    let requestId
    try {
      requestId = this.repo.createRequest(userRequest)
    } catch (error) {
      return Promise.reject(new FailedToCreateRequestError(error, `Failed to create request: ${error.message}`))
    }

    const p = new Promise((resolve, reject) => {
      let resourcesPending = 0
      let waitingForResource = true
      const reservations = []
      try {
        requestId = this.repo.createRequest(userRequest)
        const resourceIds = this.getSuitableResourceIds(userRequest)
        resourcesPending = resourceIds.length
        resourceIds.forEach((resourceId) => {
          reservations.push({
            resourceId,
            reservationId: this.repo.addReservation({resourceId, requestId})
          })
        })
      } catch (error) {
        reservations.forEach(({reservationId}) => {
          try {
            this.repo.reservationFailed(reservationId, error)
          } catch (ignore) {
            // TODO: Logging
          }
        })
        return reject(error)
      }

      if (isEmpty(reservations)) {
        return reject(new NoSuitableResourceError())
      }

      reservations.forEach(({resourceId, reservationId}) => {
        Promise.resolve(this.getResource(resourceId).queue.enqueue(() => {
          // Reached head of queue for this resource
          resourcesPending -= 1
          if (waitingForResource) {
            // This is the first resource that became available for the request.
            this.repo.reservationAcquired(reservationId)
            waitingForResource = false
            // when this settles, it will dequeue for this resource
            return Promise.method(onAvailable)({resourceId, reservationId})
              // we can now settle our returned promise, indicating that
              // the resource is freed.
              .finally(() => {
                this.repo.reservationComplete(reservationId)
              })
              .tap(resolve)
              .tapCatch(reject)
          } else {
            this.repo.reservationCanceled(reservationId)
          }
        }))
          .catch((reason) => {
            // Error enqueing with this resource
            // TODO: We want to log this, unconditionally
            resourcesPending -= 1
            this.repo.reservationFailed(reservationId, reason)
            if (waitingForResource && resourcesPending === 0) {
              reject(new FailedToObtainAnyResourcesError())
            }
          })
      })
    })
    return {
      requestId,
      then: p.then.bind(p)
    }
  }
}

export function newResourcePool (options) {
  const pool = new Pool(options)
  return {
    requestResource: pool.requestResource.bind(pool),
    addResource: pool.addResource.bind(pool),
    getResourceProperties: pool.getResourceProperties.bind(pool),
    getResourceIds: pool.getResourceIds.bind(pool),
    getResourceCount: pool.getResourceCount.bind(pool)
  }
}
