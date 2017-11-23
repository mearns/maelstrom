import fs from 'mz/fs'
import path from 'path'
import Promise from 'bluebird'
import {makeExecutableSchema} from 'graphql-tools'

function loadSchema (name) {
  return fs.readFile(path.resolve(__dirname, `./schema/${name}.graphql`), 'utf8')
}

export function getExecutableSchema (_names, _resolverMaps) {
  const names = _names instanceof Array ? _names : [_names]
  const resolverMaps = _resolverMaps instanceof Array ? _resolverMaps : [_resolverMaps]
  return Promise.join(
    Promise.map(names, loadSchema),
    Promise.all(resolverMaps),
    (schema, resolvers) => makeExecutableSchema({
      typeDefs: schema,
      resolvers
    })
  )
}
