import { Server, type Request, type ResponseToolkit } from '@hapi/hapi'
import * as Hoek from '@hapi/hoek'
import * as Boom from '@hapi/boom'

interface ApiKeyPluginOptions {
  apiKey?: string | string[] | ((request: any) => string | string[]) | Promise<string | string[]>,
  headerName?: string
  queryParamName?: string
}

const defaultOptions: ApiKeyPluginOptions = {
  headerName: 'x-api-key',
  queryParamName: 'api-key'
}

let setOptions: ApiKeyPluginOptions

const plugin = {
  name: 'hapi-api-key-auth',
  register: async function (server: Server, options: ApiKeyPluginOptions = {}) {
    setOptions = Object.freeze(Hoek.applyToDefaults(defaultOptions, options))
    server.auth.scheme('api-key', scheme)
  }
}

function scheme (_server: Server, options: any) {
  if (!setOptions.apiKey) {
    throw new Error('"apiKey" must be specified')
  }

  if (!setOptions.headerName && !setOptions.queryParamName) {
    throw new Error('At least one of "headerName" or "queryParamName" must be specified')
  }

  return { authenticate }
}

async function authenticate (request: Request, h: ResponseToolkit) {
  let supportedApiKeys: string[]

  if (typeof setOptions.apiKey === 'function') {
    const requestedApiKeys = setOptions.apiKey(request)

    if (Array.isArray(requestedApiKeys)) {
      supportedApiKeys = requestedApiKeys
    } else if (typeof requestedApiKeys === 'string') {
      supportedApiKeys = [requestedApiKeys]
    } else {
      throw new Error('"apiKey" function must return a string or an array of strings')
    }
  }

  if (setOptions.apiKey instanceof Promise) {
    const requestedApiKeys = await setOptions.apiKey

    if (Array.isArray(requestedApiKeys)) {
      supportedApiKeys = requestedApiKeys
    } else if (typeof requestedApiKeys === 'string') {
      supportedApiKeys = [requestedApiKeys]
    } else {
      throw new Error('"apiKey" promise must resolve to a string or an array of strings')
    }
  }

  if (Array.isArray(setOptions.apiKey)) {
    supportedApiKeys = setOptions.apiKey
  } else if (typeof setOptions.apiKey === 'string') {
    supportedApiKeys = [setOptions.apiKey]
  }

  const providedApiKeys: string[] = []

  if (setOptions.headerName) {
    const headerApiKey = request.headers[setOptions.headerName]

    if (headerApiKey) {
      providedApiKeys.push(headerApiKey.toString())
    }
  }

  if (setOptions.queryParamName) {
    const queryApiKey = request.query[setOptions.queryParamName]

    if (queryApiKey) {
      providedApiKeys.push(queryApiKey.toString())
    }
  }

  const matchingApiKeys = providedApiKeys.filter(key => supportedApiKeys.includes(key))
  const isValid = matchingApiKeys.length > 0

  if (!isValid) {
    throw Boom.unauthorized('Invalid API key')
  }

  return h.authenticated({ credentials: { apiKey: matchingApiKeys[0] } })
}

export default plugin

export type { ApiKeyPluginOptions }
