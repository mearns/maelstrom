
function extendError (name, constructor) {
  const e = function (...args) {
    const message = args[args.length - 3]
    const fileName = args[args.length - 2]
    const lineNumber = args[args.length - 1]
    var instance = new Error(message, fileName, lineNumber)
    instance.name = name
    Object.setPrototypeOf(instance, Object.getPrototypeOf(this))
    Error.captureStackTrace(instance, e)
    constructor.bind(instance)(...args)
    return instance
  }
  e.prototype = Object.create(Error.prototype, {
    constructor: {
      value: Error,
      enumerable: false,
      writable: true,
      configurable: true
    }
  })
  return e
}

export const IllegalStateError = extendError('IllegalStateError',
  function (message) {
    this.message = message
  }
)

export const NoSuitableResourceError = extendError('NoSuitableResourceError',
  function (message = 'There are no known resources that are suitable for the given request.') {
    this.message = message
  }
)

export const IllegalResourceError = extendError('IllegalResourceError',
  function (message = 'The specified resource is not valid') {
    this.message = message
  }
)

export const NoSuchRequestError = extendError('NoSuchRequestError',
  function (requestId, message) {
    this.message = message || `No such request: ${requestId}`
    this.requestId = requestId
  }
)

export const NoSuchPoolError = extendError('NoSuchPoolError',
  function (poolId, message) {
    this.message = message || `No such pool: ${poolId}`
    this.poolId = poolId
  }
)

export const NoSuchResourceError = extendError('NoSuchResourceError',
  function (resourceId, message) {
    this.message = message || `No such resource: ${resourceId}`
    this.resourceId = resourceId
  }
)

export const PoolAlreadyExistsError = extendError('PoolAlreadyExistsError',
  function (poolId, message) {
    this.message = message || `Cannot create a pool with id '${poolId}' because a pool with this id already exists`
    this.poolId = poolId
  }
)

export const FailedToCreateRequestError = extendError('FailedToCreateRequestError',
  function (cause, message = 'Failed to create request') {
    this.message = message
    this.cause = cause
  }
)
