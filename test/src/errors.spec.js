/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import * as errors from '../../src/errors'

// Support
import {expect} from 'chai'

describe('The errors module', () => {
  describe('NoSuchReservationError', () => {
    it('should be an instanceOf Error', () => {
      // given
      const errorUnderTest = new errors.NoSuchReservationError()

      // expect
      expect(errorUnderTest).to.be.instanceOf(Error)
    })

    it('should be an instance of NoSuchReservationError', () => {
      // given
      const errorUnderTest = new errors.NoSuchReservationError()

      // expect
      expect(errorUnderTest).to.be.instanceOf(errors.NoSuchReservationError)
    })

    it('should have the correct name property', () => {
      // given
      const errorUnderTest = new errors.NoSuchReservationError()

      // expect
      expect(errorUnderTest).to.have.property('name', 'NoSuchReservationError')
    })

    it('should have the correct message property', () => {
      // given
      const testMessage = 'My test message'
      const errorUnderTest = new errors.NoSuchReservationError(null, testMessage)

      // expect
      expect(errorUnderTest).to.have.property('message', testMessage)
    })
  })
})
