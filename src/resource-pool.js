import {Queue} from 'task-queue'
import uuid from 'uuid'
import {isEmpty} from 'ramda'
import {NoSuitableResourceError, FailedToQueueForResource} from './errors'

class Pool {
  constructor () {
    this.resources = {}
    this.requests = {}
  }

  addResource () {
    const resourceId = this.newResourceId()
    this.resources[resourceId] = {
      queue: new Queue()
    }
  }

  newRequestId () {
    return uuid.v4()
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

  requestResource (userRequest) {
    const requestId = this.newRequestId()
    const requestObj = {}
    this.requests[requestId] = requestObj

    const promiseForResource = new Promise((resolve, reject) => {
      requestObj.resourceIds = this.getSuitableResourceIds(userRequest)
      if (isEmpty(requestObj.resourceIds)) {
        reject(new NoSuitableResourceError(userRequest))
      }
      requestObj.state = 'WAITING_FOR_RESOURCE'
      requestObj.resourceIds.forEach((resourceId) => {
        this.getResource(resourceId).queue.enqueue(() => {
          if (requestObj.state === 'WAITING_FOR_RESOURCE') {
            requestObj.state = 'RESOURCE_ACQUIRED'
            requestObj.resourceId = resourceId
            resolve({resourceId})
          }
        })
          .then(null, (reason) => {
            // XXX TODO: Race condition here, if another queue has already fulfilled,
            // the promise is already fulfilled, so this will be ignored. Which is
            // fine except for the fact that we're unaware of the issue. We should
            // probably log it.
            // Also, it may not even be appropriate to reject even if the first settled
            // queue rejects, because it could succeed on some other queues. So we
            // want to do some kind of collection of promises.
            reject(new FailedToQueueForResource(resourceId))
          })
      })
    })
      .then(null, (reason) => {
        requestObj.state = 'REJECTED'
        requestObj.rejectionReason = reason
        return Promise.reject(reason)
      })
    requestObj.promise = promiseForResource
    return {
      requestId: requestId,
      then: promiseForResource.then.bind(promiseForResource)
    }
  }
}

export function newResoucePool () {
  const pool = new Pool()
  return {
    requestResource: pool.requestResource.bind(pool)
  }
}
