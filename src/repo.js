import {newIdSupplier} from './id-supplier'
import {NoSuchRequestError, NoSuchReservationError,
  IllegalReservationStateTransitionError, PoolAlreadyExistsError, NoSuchPoolError} from './errors'

const RESERVATION_STATE_WAITING = 'waiting'
const RESERVATION_STATE_ACQUIRED = 'resource-acquired'
const RESERVATION_STATE_CANCELED = 'canceled'
const RESERVATION_STATE_COMPLETE = 'complete'
const RESERVATION_STATE_FAILED = 'failed'

const REQUEST_STATE_WAITING = 'waiting'
const REQUEST_STATE_ACQUIRED = 'resource-acquired'
const REQUEST_STATE_COMPLETE = 'complete'
const REQUEST_STATE_FAILED = 'failed'

function ensureReservationStateTransitionValid (reservationId, currentState, intendedState) {
  switch (currentState) {
    case RESERVATION_STATE_WAITING:
      if (intendedState === RESERVATION_STATE_ACQUIRED || intendedState === RESERVATION_STATE_CANCELED || intendedState === RESERVATION_STATE_FAILED) {
        return
      }
      break

    case RESERVATION_STATE_ACQUIRED:
      if (intendedState === RESERVATION_STATE_COMPLETE) {
        return
      }
  }
  throw new IllegalReservationStateTransitionError(reservationId, currentState, intendedState)
}

class TransientRepo {
  constructor () {
    this.poolRepos = {}
  }

  createPoolRepo ({poolId}) {
    if (this.poolRepos[poolId]) {
      throw new PoolAlreadyExistsError(poolId)
    }
    this.poolRepos[poolId] = new TransientRequestRepo()
    return Promise.resolve(this.poolRepos[poolId])
  }

  getPoolRepo (poolId) {
    const poolRepo = this.poolRepos[poolId]
    if (!poolRepo) {
      throw new NoSuchPoolError(poolId)
    }
    return Promise.resolve(poolRepo)
  }
}

class TransientRequestRepo {
  constructor () {
    this.requests = {}
    this.requestIdSupplier = newIdSupplier()
    this.reservations = {}
    this.reservationIdSupplier = newIdSupplier()
  }

  createRequest ({description = null} = {}) {
    const requestId = this.requestIdSupplier.get()
    this.requests[requestId] = {
      description: String(description),
      reservations: []
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

  getRequestState (requestId) {
    return Promise.resolve()
      .then(() => {
        const reservations = this.getRequest(requestId).reservations
        if (reservations.some((r) => r.state === RESERVATION_STATE_COMPLETE)) {
          return REQUEST_STATE_COMPLETE
        } else if (reservations.some((r) => r.state === RESERVATION_STATE_ACQUIRED)) {
          return REQUEST_STATE_ACQUIRED
        } else if (reservations.some((r) => r.state === RESERVATION_STATE_WAITING)) {
          return REQUEST_STATE_WAITING
        }
        return REQUEST_STATE_FAILED
      })
  }

  getReservation (reservationId) {
    const reservation = this.reservations[reservationId]
    if (!reservation) {
      return Promise.reject(new NoSuchReservationError(reservationId))
    }
    return Promise.resolve(reservation)
  }

  getReservationState (reservationId) {
    return this.getReservation(reservationId)
      .then((reservation) => reservation.state)
  }

  addReservation ({resourceId, requestId}) {
    return this.getRequest(requestId)
      .then((request) => {
        const reservationId = this.reservationIdSupplier.get()
        const reservation = {
          requestId,
          resourceId,
          state: RESERVATION_STATE_WAITING
        }
        this.reservations[reservationId] = reservation
        request.reservations.push(reservation)
        return reservationId
      })
  }

  ensureReservationStateTransitionValid (reservationId, intendedState) {
    return this.getReservation(reservationId)
      .then((reservation) => {
        ensureReservationStateTransitionValid(reservationId, reservation.state, intendedState)
        return reservation
      })
  }

  transitionReservation (reservationId, toState) {
    return this.ensureReservationStateTransitionValid(reservationId, toState)
      .then((reservation) => {
        reservation.state = toState
        return reservation
      })
  }

  reservationAcquired (reservationId) {
    return this.transitionReservation(reservationId, RESERVATION_STATE_ACQUIRED)
  }

  reservationComplete (reservationId) {
    return this.transitionReservation(reservationId, RESERVATION_STATE_COMPLETE)
  }

  reservationCanceled (reservationId) {
    return this.transitionReservation(reservationId, RESERVATION_STATE_CANCELED)
  }

  reservationFailed (reservationId, error) {
    return this.transitionReservation(reservationId, RESERVATION_STATE_FAILED)
      .then((reservation) => {
        reservation.error = error
      })
  }
}

export function newTransientRepo () {
  return new TransientRepo()
}
