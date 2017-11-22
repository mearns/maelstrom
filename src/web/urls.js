import url from 'url'

export const API_URL = '/api/'

export const GRAPHQL_URL_SEGMENT = 'graphql'

export function getGraphQLUrl () {
  return url.resolve(API_URL, GRAPHQL_URL_SEGMENT)
}
