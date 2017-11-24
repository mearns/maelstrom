import {getExecutableSchema} from '../schema-tools'

export function getGraphQLExecutableSchema (options) {
  return getExecutableSchema('schema', getGraphQLResolverMap(options))
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
      name: ({name}) => name,
      value: ({value}) => value
    },
    PropertyValue: {
      __resolveType: (value, context, info) => {
        switch (typeof value) {
          case 'undefined':
            return 'NullPropertyValue'
          case 'string':
            return 'StringPropertyValue'
          case 'number':
            if (value === parseInt(value)) {
              return 'IntPropertyValue'
            }
            return 'FloatPropertyValue'
          case 'boolean':
            return 'BooleanPropertyValue'
          case 'object':
            if (value === null) {
              return 'NullProperty'
            } else if (value.hasOwnProperty('value') && value.hasOwnProperty('unit')) {
              if (typeof value.value === 'number' && typeof value.unit === 'string') {
                const strippedUnit = value.unit.endsWith('B')
                  ? value.unit.substring(0, value.unit.length - 1)
                  : value.unit
                const unit = strippedUnit.length === 0 ? 'U' : strippedUnit
                const prefixType = info.schema.getType('MultiplierPrefix')
                const unitType = prefixType.getValues().find(({name}) => name === unit)
                if (unitType) {
                  context.storageSize = {
                    unitType,
                    normalizedUnit: unitType.name === 'U' ? 'B' : unitType.name + 'B'
                  }
                  return 'StorageSizePropertyValue'
                }
              }
            }
        }
        return null
      }
    },
    StringPropertyValue: {
      str: (value) => value,
      value: (value) => value,
      valueType: (obj, args, context, info) => info.schema.getType('String')
    },
    IntPropertyValue: {
      str: (value) => String(value),
      value: (value) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Int')
    },
    FloatPropertyValue: {
      str: (value) => String(value),
      value: (value) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Float')
    },
    BooleanPropertyValue: {
      str: (value) => String(value),
      value: (value) => value,
      valueType: (obj, args, context, info) => info.schema.getType('Boolean')
    },
    StorageSizePropertyValue: {
      str: ({value, unit}, args, context) => `${value}${context.storageSize.normalizedUnit}`,
      value: (value) => value,
      valueType: (obj, args, context, info) => info.schema.getType('StorageSize')
    },
    NullPropertyValue: {
      str: () => 'null',
      value: () => null,
      valueType: (obj, args, context, info) => info.schema.getType('String')
    }
  }
}
