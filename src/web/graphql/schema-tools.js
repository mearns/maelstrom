import fs from 'mz/fs'
import path from 'path'
import Promise from 'bluebird'
import {makeExecutableSchema} from 'graphql-tools'
import merge from 'lodash.merge'

export function loadSchema (name) {
  return fs.readFile(path.resolve(__dirname, `./schema/${name}.graphql`), 'utf8')
}

export function getExecutableSchema (_typeDefs = [], _resolverMaps = []) {
  const typeDefs = _typeDefs instanceof Array ? _typeDefs : [_typeDefs]
  const resolverMaps = _resolverMaps instanceof Array ? _resolverMaps : [_resolverMaps]
  return Promise.join(
    Promise.all(typeDefs),
    Promise.all(resolverMaps),
    (schema, resolverMaps) => {
      return makeExecutableSchema({
        typeDefs: schema,
        resolvers: merge({}, ...resolverMaps)
      })
    }
  )
}
