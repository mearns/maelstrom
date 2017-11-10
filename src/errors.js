
export class NoSuitableResourceError extends Error {
  constructor (message = 'There are no known resources that are suitable for the given request.') {
    super(message)
    Error.captureStackTrace(this, NoSuitableResourceError)
  }
}

export class FailedToObtainAnyResourcesError extends Error {
  constructor (message = 'Failed to obtain any of the requested resources') {
    super(message)
    Error.captureStackTrace(this, FailedToObtainAnyResourcesError)
  }
}
