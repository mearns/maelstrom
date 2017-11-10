
export class NoSuitableResourceError extends Error {
  constructor (request, message = 'There are no known resources that are suitable for the given request.') {
    super(message)
    Error.captureStackTrace(this, NoSuitableResourceError)
    this.request = request
  }
}

export class FailedToQueueForResource extends Error {
  constructor (resourceId, message) {
    super(message || `Failed to queue up request for resource ${resourceId}`)
    Error.captureStackTrace(this, NoSuitableResourceError)
    this.resourceId = resourceId
  }
}
