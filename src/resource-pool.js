import {Queue} from 'task-queue'
import uuid from 'uuid'
import {isEmpty} from 'ramda'
import {NoSuitableResourceError, FailedToObtainAnyResourcesError} from './errors'
import Promise from 'bluebird'

class Pool {
  constructor () {
    this.resources = {}
  }

  addResource () {
    const resourceId = this.newResourceId()
    this.resources[resourceId] = {
      queue: new Queue()
    }
    return resourceId
  }

  newResourceId () {
    return uuid.v4()
  }

  getResource (resourceId) {
    return this.resources[resourceId]
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
    return new Promise((resolve, reject) => {
      const resourceIds = this.getSuitableResourceIds(userRequest)
      if (isEmpty(resourceIds)) {
        reject(new NoSuitableResourceError())
      }
      let resourcesPending = resourceIds.length
      let waitingForResource = true
      resourceIds.forEach((resourceId) => {
        Promise.resolve(this.getResource(resourceId).queue.enqueue(() => {
          // Reached head of queue for this resource
          resourcesPending -= 1
          if (waitingForResource) {
            // The first resource that became available.
            waitingForResource = false
            // when this settles, it will dequeue for this resource
            return Promise.method(onAvailable)(resourceId)
              // we can now settle our returned promise, indicating that
              // the resource is freed.
              .tap(resolve)
              .tapCatch(reject)
          }
        }))
          .catch((reason) => {
            // Error enqueing with this resource
            // TODO We want to log this, unconditionally
            resourcesPending -= 1
            if (waitingForResource && resourcesPending === 0) {
              reject(new FailedToObtainAnyResourcesError())
            }
          })
      })
    })
  }
}

export function newResoucePool () {
  const pool = new Pool()
  return {
    requestResource: pool.requestResource.bind(pool),
    addResource: pool.addResource.bind(pool)
  }
}
