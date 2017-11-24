
import {getExecutableSchema} from '../../src/web/graphql/schema-tools'
import {addMockFunctionsToSchema} from 'graphql-tools'
import {graphql} from 'graphql'

export function createQueryTestRunner (module) {
  return function runQuery ({mocks = {}, queryTypeDef, query}) {
    return Promise.resolve(getExecutableSchema(
      [module.getTypeDefs(), queryTypeDef],
      module.getResolverMap()
    ))
      .then((schema) => {
        addMockFunctionsToSchema({
          schema, mocks, preserveResolvers: true
        })
        return graphql(schema, query)
      })
  }
}
