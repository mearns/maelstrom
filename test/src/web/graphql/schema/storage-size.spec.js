/* eslint-env mocha */
/* eslint no-unused-expressions:0 */  // for expect magic.

// Module under test
import {getResolverMap, getTypeDefs, StorageSize} from '../../../../../src/web/graphql/schema/storage-size'

// Support modules
import {getExecutableSchema} from '../../../../../src/web/graphql/schema-tools'
import {addMockFunctionsToSchema} from 'graphql-tools'
import {expect} from 'chai'
import {graphql} from 'graphql'
import Promise from 'bluebird'

describe('storage-size schema module', () => {
  describe('type MultiplierPrefix', () => {
    it('should do something', () => {
      // given
      const mocks = {
        StorageSize: () => new StorageSize({
          value: 12345,
          unit: 'Mi'
        })
      }

      return Promise.resolve(getExecutableSchema(
        [getTypeDefs(), `type Query {testQuery: StorageSize}`],
        getResolverMap())
      )
        .then((executableSchema) => {
          addMockFunctionsToSchema({schema: executableSchema, mocks, preserveResolvers: true})
          return graphql(executableSchema, `
{ testQuery { value, unit, scale, str, bytes } }
          `)
        })
        .tap((response) => {
          console.log(response)
        })
        .then(({data: {testQuery}}) => {
          expect(testQuery.value).to.equal(12345)
          expect(testQuery.unit).to.equal('Mi')
          expect(testQuery.scale).to.equal(1024 * 1024)
          expect(testQuery.str).to.equal('12345MiB')
          expect(testQuery.bytes).to.equal(12345 * 1024 * 1024)
        })
    })
  })
})
