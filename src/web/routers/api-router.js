import {makeExecutableSchema} from 'graphql-tools'
import {graphqlExpress, graphiqlExpress} from 'apollo-server-express'
import Promise from 'bluebird'
import fs from 'mz/fs'
import path from 'path'
import bodyParser from 'body-parser'
import {getGraphQLUrl} from '../urls'

export function configure (app, options) {
  return addGraphQLRouter(app, options)
}

function addGraphQLRouter (app, options) {
  return getGraphQLExecutableSchema(options)
    .then((executableSchema) => {
      app.use('/graphql', bodyParser.json(), graphqlExpress({schema: executableSchema}))
      app.use('/graphiql', graphiqlExpress({endpointURL: getGraphQLUrl()}))
    }
  )
}

function getGraphQLExecutableSchema (options) {
  return Promise.join(
    getGraphQLSchema(options),
    getGraphQLResolverMap(options),
    (schema, resolvers) => makeExecutableSchema({
      typeDefs: schema,
      resolvers
    })
  )
}

function getGraphQLSchema () {
  return fs.readFile(path.resolve(__dirname, 'schema.graphql'), 'utf8')
}

function getGraphQLResolverMap ({poolCollection}) {
  return {
    Query: {
      pools: () => poolCollection.getPoolIds()
    },
    ResourcePool: {
      id: poolId => poolId,
      name: poolId => poolId,
      resources: (poolId, args, context) => {
        context.pool = poolCollection.getPool(poolId)
        return context.pool.getResourceIds()
      }
    },
    Resource: {
      id: resourceId => resourceId,
      properties: (resourceId, args, context) => {
        const props = context.pool.getResourceProperties(resourceId)
        return Object.keys(props).map(key => ({
          name: key,
          value: props[key]
        }))
      },
      prop: (resourceId, {name: propName}, context) => {
        const props = context.pool.getResourceProperties(resourceId)
        if (props.hasOwnProperty(propName)) {
          return {name: propName, value: props[propName]}
        }
        return null
      }
    },
    ResourceProperty: {
      name: ({name}) => name,
      value: ({value}, args, context) => value
    }
  }
}
