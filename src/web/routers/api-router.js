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

const STORAGE_UNIT_SCALE_VALUES = {
  B: 1,
  KB: 1e3,
  MG: 1e6,
  GB: 1e9,
  TB: 1e12,
  PB: 1e15,
  EB: 1e18,
  ZB: 1e21,
  YB: 1e24,
  KiB: 1024,
  MiB: 1024 * 1024,
  GiB: 1024 * 1024 * 1024,
  TiB: 1024 * 1024 * 1024 * 1024,
  PiB: 1024 * 1024 * 1024 * 1024 * 1024,
  EiB: 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  ZiB: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024,
  YiB: 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
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
    Property: {
      __resolveType: ({name, value}, context, info) => {
        switch (typeof value) {
          case 'undefined':
            return 'NullProperty'
          case 'string':
            return 'StringProperty'
          case 'number':
            if (value === parseInt(value)) {
              return 'IntProperty'
            }
            return 'FloatProperty'
          case 'boolean':
            return 'BooleanProperty'
          case 'object':
            if (value === null) {
              return 'NullProperty'
            } else if (value.hasOwnProperty('value') && value.hasOwnProperty('unit')) {
              const storageUnitType = info.schema.getType('StorageUnit')
              if (typeof value.value === 'number' && storageUnitType.getValues().some(({name}) => name === value.unit)) {
                return 'StorageSizeProperty'
              }
            }
        }
        return null
      }
    },
    StringProperty: {
      name: ({name}) => name,
      str: ({value}) => value,
      value: ({value}) => value,
      valueType: (obj, args, context, info) => info.schema.getType('String')
    },
    IntProperty: {
      name: ({name}) => name,
      str: ({value}) => String(value),
      value: ({value}) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Int')
    },
    FloatProperty: {
      name: ({name}) => name,
      str: ({value}) => String(value),
      value: ({value}) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Float')
    },
    BooleanProperty: {
      name: ({name}) => name,
      str: ({value}) => String(value),
      value: ({value}) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Boolean')
    },
    StorageSizeProperty: {
      name: ({name}) => name,
      str: ({value: {value, unit}}) => `${value}${unit}`,
      value: ({value}) => value,
      valueType: (obj, args, context, info) => info.schema.getType('StorageSize')
    },
    NullProperty: {
      name: ({name}) => name,
      str: () => 'null',
      value: () => null,
      valueType: (obj, args, context, info) => info.schema.getType('String')
    },
    StorageSize: {
      scale: ({unit}) => STORAGE_UNIT_SCALE_VALUES[unit],
      str: ({value, unit}) => `${value}${unit}`,
      bytes: ({value, unit}) => {
        return STORAGE_UNIT_SCALE_VALUES[unit] * value
      }
    }
  }
}
