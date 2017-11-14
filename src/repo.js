import {getIdSupplier} from './id-supplier'
import {NoSuchRequestError, NoSuchReservationError, IllegalReservationStateTransitionError} from './errors'

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
    this.requests = {}
    this.requestIdSupplier = getIdSupplier()
    this.reservations = {}
    this.reservationIdSupplier = getIdSupplier()
  }

  createRequest ({description = null} = {}) {
    const requestId = this.requestIdSupplier.get()
    this.requests[requestId] = {
      description: String(description),
      reservations: []
    }
    return requestId
  }

  getRequest (requestId) {
    const request = this.requests[requestId]
    if (!request) {
      throw new NoSuchRequestError(requestId)
    }
    return request
  }

  getRequestState (requestId) {
    const reservations = this.getRequest(requestId).reservations
    if (reservations.some((r) => r.state === RESERVATION_STATE_COMPLETE)) {
      return REQUEST_STATE_COMPLETE
    } else if (reservations.some((r) => r.state === RESERVATION_STATE_ACQUIRED)) {
      return REQUEST_STATE_ACQUIRED
    } else if (reservations.some((r) => r.state === RESERVATION_STATE_WAITING)) {
      return REQUEST_STATE_WAITING
    }
    return REQUEST_STATE_FAILED
  }

  getReservation (reservationId) {
    const reservation = this.reservations[reservationId]
    if (!reservation) {
      throw new NoSuchReservationError(reservationId)
    }
    return reservation
  }

  getReservationState (reservationId) {
    return this.getReservation(reservationId).state
  }

  addReservation ({resourceId, requestId}) {
    const request = this.getRequest(requestId)
    const reservationId = this.reservationIdSupplier.get()
    const reservation = {
      requestId,
      resourceId,
      state: RESERVATION_STATE_WAITING
    }
    this.reservations[reservationId] = reservation
    request.reservations.push(reservation)
    return reservationId
  }

  ensureReservationStateTransitionValid (reservationId, intendedState) {
    const reservation = this.getReservation(reservationId)
    ensureReservationStateTransitionValid(reservationId, reservation.state, intendedState)
    return reservation
  }

  transitionReservation (reservationId, toState) {
    const reservation = this.ensureReservationStateTransitionValid(reservationId, toState)
    reservation.state = toState
    return reservation
  }

  reservationAcquired (reservationId) {
    this.transitionReservation(reservationId, RESERVATION_STATE_ACQUIRED)
  }

  reservationComplete (reservationId) {
    this.transitionReservation(reservationId, RESERVATION_STATE_COMPLETE)
  }

  reservationCanceled (reservationId) {
    this.transitionReservation(reservationId, RESERVATION_STATE_CANCELED)
  }

  reservationFailed (reservationId, error) {
    const reservation = this.transitionReservation(reservationId, RESERVATION_STATE_FAILED)
    reservation.error = error
  }
}

export function newTransientRepo () {
  return new TransientRepo()
}
