import {getIdSupplier} from './id-supplier'
import {NoSuchRequestError, NoSuchReservationError, IllegalReservationStateTransitionError} from './errors'

const STATE_WAITING_IN_QUEUE = 'waiting-in-queue'
const STATE_ACQUIRED = 'resource-acquired'
const STATE_CANCELED = 'canceled'
const STATE_COMPLETE = 'complete'
const STATE_FAILED_TO_QUEUE = 'failed-to-queue'

function ensureReservationStateTransitionValid (reservationId, currentState, intendedState) {
  switch (currentState) {
    case STATE_WAITING_IN_QUEUE:
      if (intendedState === STATE_ACQUIRED || intendedState === STATE_CANCELED || intendedState === STATE_FAILED_TO_QUEUE) {
        return
      }
      break

    case STATE_ACQUIRED:
      if (intendedState === STATE_COMPLETE) {
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
      description: String(description)
    }
    return requestId
  }

  addReservation ({resourceId, requestId}) {
    if (!this.requests[requestId]) {
      throw new NoSuchRequestError(requestId)
    }
    const reservationId = this.reservationIdSupplier.get()
    this.reservations[reservationId] = {
      requestId,
      resourceId,
      state: STATE_WAITING_IN_QUEUE
    }
    return reservationId
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

  ensureReservationStateTransitionValid (reservationId, intendedState) {
    const reservation = this.getReservation(reservationId)
    ensureReservationStateTransitionValid(reservationId, reservation.state, intendedState)
    return reservation
  }

  transitionReservation (reservationId, toState) {
    const reservation = this.ensureReservationStateTransitionValid(reservationId, toState)
    reservation.state = toState
  }

  reservationAcquired (reservationId) {
    this.transitionReservation(reservationId, STATE_ACQUIRED)
  }

  reservationComplete (reservationId) {
    this.transitionReservation(reservationId, STATE_COMPLETE)
  }

  reservationCanceled (reservationId) {
    this.transitionReservation(reservationId, STATE_CANCELED)
  }

  reservationFailedToQueue (reservationId) {
    this.transitionReservation(reservationId, STATE_FAILED_TO_QUEUE)
  }
}

export function newTransientRepo () {
  return new TransientRepo()
}
