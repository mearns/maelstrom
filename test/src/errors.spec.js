/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import * as errors from '../../src/errors'

// Support
import {expect} from 'chai'

describe('The errors module', () => {
  describe('IllegalReservationStateTransitionError', () => {
    it('should be an instanceOf Error', () => {
      // given
      const errorUnderTest = new errors.IllegalReservationStateTransitionError()

      // expect
      expect(errorUnderTest).to.be.instanceOf(Error)
    })

    it('should be an instance of IllegalReservationStateTransitionError', () => {
      // given
      const errorUnderTest = new errors.IllegalReservationStateTransitionError()

      // expect
      expect(errorUnderTest).to.be.instanceOf(errors.IllegalReservationStateTransitionError)
    })

    it('should have the correct name property', () => {
      // given
      const errorUnderTest = new errors.IllegalReservationStateTransitionError()

      // expect
      expect(errorUnderTest).to.have.property('name', 'IllegalReservationStateTransitionError')
    })

    it('should have the correct message property', () => {
      // given
      const testMessage = 'My test message'
      const errorUnderTest = new errors.IllegalReservationStateTransitionError(null, null, null, testMessage)

      // expect
      expect(errorUnderTest).to.have.property('message', testMessage)
    })
  })
})
