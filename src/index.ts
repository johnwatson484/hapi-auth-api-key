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

let providedOptions: ApiKeyPluginOptions

const plugin = {
  name: 'hapi-api-key-auth',
  register: async function (server: Server, options: ApiKeyPluginOptions = {}) {
    providedOptions = Object.freeze(Hoek.applyToDefaults(defaultOptions, options))
    server.auth.scheme('api-key', scheme)
  }
}

function scheme () {
  if (!providedOptions.apiKey) {
    throw new Error('"apiKey" must be specified')
  }

  if (!providedOptions.headerName && !providedOptions.queryParamName) {
    throw new Error('At least one of "headerName" or "queryParamName" must be specified')
  }

  return { authenticate }
}

async function authenticate (request: Request, h: ResponseToolkit) {
  const supportedApiKeys = await getSupportedApiKeys(request)
  const providedApiKeys = getProvidedApiKeys(request)
  const matchingApiKeys = providedApiKeys.filter(key => supportedApiKeys.includes(key))

  if (matchingApiKeys.length === 0) {
    throw Boom.unauthorized('Invalid API key')
  }

  return h.authenticated({ credentials: { apiKey: matchingApiKeys[0] } })
}

async function getSupportedApiKeys (request: Request): Promise<string[]> {
  const { apiKey } = providedOptions

  if (typeof apiKey === 'function') {
    const result = apiKey(request)
    return normalizeToStringArray(result, '"apiKey" function must return a string or an array of strings')
  }

  if (apiKey instanceof Promise) {
    const result = await apiKey
    return normalizeToStringArray(result, '"apiKey" promise must resolve to a string or an array of strings')
  }

  return normalizeToStringArray(apiKey!, '"apiKey" must be a string or an array of strings')
}

function normalizeToStringArray (value: string | string[], errorMessage: string): string[] {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    return [value]
  }
  throw new Error(errorMessage)
}

function getProvidedApiKeys (request: Request): string[] {
  const providedApiKeys: string[] = []

  if (providedOptions.headerName) {
    const headerApiKey = request.headers[providedOptions.headerName]
    if (headerApiKey) {
      providedApiKeys.push(headerApiKey.toString())
    }
  }

  if (providedOptions.queryParamName) {
    const queryApiKey = request.query[providedOptions.queryParamName]
    if (queryApiKey) {
      providedApiKeys.push(queryApiKey.toString())
    }
  }

  return providedApiKeys
}

export default plugin

export type { ApiKeyPluginOptions }
