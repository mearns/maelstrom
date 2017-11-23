import {graphqlExpress, graphiqlExpress} from 'apollo-server-express'
import {getGraphQLExecutableSchema} from '../graphql/schema'
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
