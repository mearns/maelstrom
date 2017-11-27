/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import * as scaledValueModule from '../../../../../src/web/graphql/schema/scaled-value'

// Support modules
import {createQueryTestRunner} from '../../../../helper/schema-test-tools'
import {chaiQuery} from '../../../../helper/chai-query'
import {suchThatChai} from '../../../../helper/such-that-chai'
import chai, {expect} from 'chai'
import Promise from 'bluebird'

chai.use(chaiQuery)
chai.use(suchThatChai)

const ScaledValue = scaledValueModule.ScaledValue

describe('scaled-value schema module', () => {
  const runQuery = createQueryTestRunner(scaledValueModule)

  it('should have all the expected fields', () => {
    // given
    const mocks = {
      ScaledValue: () => new ScaledValue({
        value: 12345,
        scaler: 'Mi'
      })
    }

    return Promise.resolve(runQuery({
      mocks,
      queryTypeDef: `type Query {testQuery: ScaledValue}`,
      // when
      query: `{testQuery {value, scaler, scale, unitMeasure, str}}`
    }))
      .then((response) => {
        expect(response).to.be.a.successfulQuery()
          .that.has.property('testQuery').that.is.deep.equal({
            value: 12345,
            scaler: 'Mi',
            scale: 1024 * 1024,
            unitMeasure: 12345 * 1024 * 1024,
            str: '12345Mi'
          })
      })
  })

  it('should support "U" as the unit', () => {
    // given
    const mocks = {
      ScaledValue: () => new ScaledValue({
        value: 314,
        scaler: 'U'
      })
    }

    return runQuery({
      mocks,
      queryTypeDef: `type Query {testQuery: ScaledValue}`,
      // when
      query: `{testQuery {value, scaler, scale, unitMeasure, str}}`
    })
      // then
      .then((response) => {
        expect(response).to.be.a.successfulQuery()
          .that.has.property('testQuery').that.is.deep.equal({
            value: 314,
            scaler: 'U',
            scale: 1,
            unitMeasure: 314,
            str: '314'
          })
      })
  })

  it('should support "B" as the unit', () => {
    // given
    const mocks = {
      StorageSize: () => new StorageSize({
        value: 1717,
        unit: 'B'
      })
    }

    return runQuery({
      mocks,
      queryTypeDef: `type Query {testQuery: StorageSize}`,
      // when
      query: `{testQuery {unit, scale, str, bytes}}`
    })
      // then
      .then(({data: {testQuery}}) => {
        expect(testQuery.unit).to.equal('U')
        expect(testQuery.scale).to.equal(1)
        expect(testQuery.str).to.equal('1717B')
        expect(testQuery.bytes).to.equal(1717)
      })
  })

  it('should support empty-string as the unit', () => {
    // given
    const mocks = {
      StorageSize: () => new StorageSize({
        value: 866,
        unit: ''
      })
    }

    return runQuery({
      mocks,
      queryTypeDef: `type Query {testQuery: StorageSize}`,
      // when
      query: `{testQuery {unit, scale, str, bytes}}`
    })
      // then
      .then(({data: {testQuery}}) => {
        expect(testQuery.unit).to.equal('U')
        expect(testQuery.scale).to.equal(1)
        expect(testQuery.str).to.equal('866B')
        expect(testQuery.bytes).to.equal(866)
      })
  })

  it('should support all the expected multiplier prefixes', () => {
    // given
    const expectedUnits = {
      U: 1,
      K: 1e3,
      M: 1e6,
      G: 1e9,
      T: 1e12,
      P: 1e15,
      E: 1e18,
      Z: 1e21,
      Y: 1e24,
      Ki: 1024,
      Mi: 1024 * 1024,
      Gi: 1024 * 1024 * 1024,
      Ti: 1024 * 1024 * 1024 * 1024,
      Pi: 1024 * 1024 * 1024 * 1024 * 1024,
      Ei: 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
      Zi: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
      Yi: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
    }

    return Promise.map(Object.keys(expectedUnits), (prefix) => {
      const expectedScale = expectedUnits[prefix]
      const mocks = {
        StorageSize: () => new StorageSize({
          value: 123,
          unit: prefix
        })
      }

      return runQuery({
        mocks,
        queryTypeDef: `type Query {testQuery: StorageSize}`,
        // when
        query: `{testQuery {unit, scale, str, bytes}}`
      })
        // then
        .then(({data: {testQuery}}) => {
          expect(testQuery.unit, `Expected unit to match for ${prefix}`).to.equal(prefix)
          expect(testQuery.scale, `Expected scale to match for ${prefix}`).to.equal(expectedScale)
          expect(testQuery.bytes, `Expected bytes to match for ${prefix}`).to.equal(123 * expectedScale)
        })
    })
  })
})
