import {newIdSupplier} from './id-supplier'
import {NoSuchReservationError,
  PoolAlreadyExistsError, NoSuchPoolError} from './errors'
import R from 'ramda'

const RESERVATION_STATE_WAITING = 'waiting'
const RESERVATION_STATE_ACQUIRED = 'resource-acquired'
const RESERVATION_STATE_COMPLETE = 'complete'
const RESERVATION_STATE_FAILED = 'failed'

class TransientRepo {
  constructor () {
    this.poolRepos = {}
  }

  createPoolRepo ({poolId}) {
    if (this.poolRepos[poolId]) {
      return Promise.reject(new PoolAlreadyExistsError(poolId))
    }
    this.poolRepos[poolId] = new TransientReservationRepo()
    return Promise.resolve(this.poolRepos[poolId])
  }

  getPoolRepo (poolId) {
    const poolRepo = this.poolRepos[poolId]
    if (!poolRepo) {
      throw new NoSuchPoolError(poolId)
    }
    return poolRepo
  }
}

class TransientReservationRepo {
  constructor () {
    this.reservations = {}
    this.reservationIdSupplier = newIdSupplier()
  }

  createReservation ({description = null} = {}) {
    const reservationId = this.reservationIdSupplier.get()
    this.reservations[reservationId] = {
      description: String(description),
      state: RESERVATION_STATE_WAITING
    }
    return Promise.resolve(reservationId)
  }

  getReservation (reservationId) {
    const reservation = this.reservations[reservationId]
    if (!reservation) {
      return Promise.reject(new NoSuchReservationError(reservationId))
    }
    return Promise.resolve(reservation)
  }

  getState (reservationId) {
    return this.getReservation(reservationId)
      .then(R.prop('state'))
  }

  getActiveResource (reservationId) {
    return this.getReservation(reservationId)
      .then(R.prop('acquiredResourceId'))
  }

  resourceAcquired (reservationId, resourceId) {
    return this.getReservation(reservationId)
      .then((reservation) => {
        reservation.state = RESERVATION_STATE_ACQUIRED
        reservation.acquiredResourceId = resourceId
      })
  }

  reservationComplete (reservationId) {
    return this.getReservation(reservationId)
      .then((reservation) => {
        reservation.state = RESERVATION_STATE_COMPLETE
      })
  }

  reservationFailed (reservationId, error) {
    return this.getReservation(reservationId)
      .then((reservation) => {
        reservation.state = RESERVATION_STATE_FAILED
        reservation.error = error
      })
  }
}

export function newTransientRepo () {
  return new TransientRepo()
}
