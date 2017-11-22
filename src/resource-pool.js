import {Queue} from 'queue-as-promised'
import {NoSuchReservationError, NoSuitableResourceError, IllegalResourceError, FailedToCreateReservationError} from './errors'
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
    this.transientReservationData = {}
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

  addResource (properties = {}) {
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
   * Given a user request for a reservation, return the list of resource IDs for known
   * resources that are suitable for the request.
   */
  getSuitableResourceIds (userRequest) {
    return Object.keys(this.resources)
  }

  requestResourceReservation (userRequest) {
    return Promise.method(this.repo.createReservation.bind(this.repo))(userRequest)
      .catch(error => {
        throw new FailedToCreateReservationError(error, `Failed to create reservation: ${error.message}`)
      })
      .then(reservationId => {
        try {
          const resourceIds = this.getSuitableResourceIds(userRequest)
          if (resourceIds.length === 0) {
            throw new NoSuitableResourceError()
          }
          this.transientReservationData[reservationId] = {
            pendingResources: resourceIds.length,
            waitingForResource: true,
            promiseToAcquire: new ExtrinsicPromise(),
            promiseToReleaseResource: new ExtrinsicPromise()
          }
          resourceIds.forEach(resourceId => this.addResourceReservation(reservationId, resourceId))
          return reservationId
        } catch (error) {
          return this.repo.reservationFailed(reservationId, error)
            .then(() => Promise.reject(error))
        }
      })
  }

  getTransientReservationData (reservationId) {
    const reservationData = this.transientReservationData[reservationId]
    if (reservationData) {
      return reservationData
    }
    throw new NoSuchReservationError(reservationId)
  }

  whenAcquired (reservationId) {
    return this.getTransientReservationData(reservationId).promiseToAcquire.hide()
  }

  addResourceReservation (reservationId, resourceId) {
    const resource = this.getResource(resourceId)
    const reservationData = this.getTransientReservationData(reservationId)
    let decremented = false
    Promise.resolve(resource.queue.enqueue(
      () => {
        if (reservationData.waitingForResource) {
          reservationData.pendingResources -= 1
          decremented = true
          reservationData.waitingForResource = false
          return Promise.resolve(this.repo.resourceAcquired(reservationId, resourceId))
            .tapCatch(error => {
              return this.repo.reservationFailed(reservationId, error)
                .finally(() => reservationData.promiseToAcquire.reject(error))
            })
            // signal to caller that resource is acquired (resolve the promise)
            .tap(() => reservationData.promiseToAcquire.fulfill({reservationId, resourceId}))
            // return to queue a promise that we can resolve when the request is complete.
            .then(() => reservationData.promiseToRelease.hide())
        }
      }))
      .catch(error => {
        if (!decremented) {
          reservationData.pendingResources -= 1
        }
        if (reservationData.pendingResources === 0 && reservationData.waitingForResource) {
          return Promise.resolve(this.repo.reservationFailed(reservationId, error))
            .finally(() => reservationData.promiseToAcquire.reject(error))
        }
      })
  }

  release (reservationId) {
    const reservationData = this.getTransientReservationData(reservationId)
    return Promise.resolve(this.repo.reservationComplete(reservationId))
      .finally(() => {
        reservationData.promiseToReleaseResource.fulfill()  // release from queue
      })
  }
}

export function newResourcePool (options) {
  const pool = new Pool(options)
  return {
    requestResourceReservation: pool.requestResourceReservation.bind(pool),
    addResource: pool.addResource.bind(pool),
    getResourceProperties: pool.getResourceProperties.bind(pool),
    getResourceIds: pool.getResourceIds.bind(pool),
    getResourceCount: pool.getResourceCount.bind(pool),
    whenAcquired: pool.whenAcquired.bind(pool),
    release: pool.release.bind(pool)
  }
}
