import * as crypto from 'node:crypto'
import { Server, type Plugin, type Request, type ResponseToolkit } from '@hapi/hapi'
import { applyToDefaults } from '@hapi/hoek'
import { unauthorized } from '@hapi/boom'
import Joi from 'joi'

interface ApiKeyPluginOptions {
  apiKey?: string | string[] | ((request: any) => string | string[] | Promise<string | string[]>),
  headerName?: string
  queryParamName?: string
}

const defaultOptions: ApiKeyPluginOptions = {
  headerName: 'x-api-key'
}

const optionsSchema = Joi.object({
  apiKey: Joi.alternatives().try(
    Joi.string().min(1).max(255),
    Joi.array().items(Joi.string().min(1).max(255)).min(1),
    Joi.function()
  ).required(),
  headerName: Joi.string().min(1).max(255).allow(''),
  queryParamName: Joi.string().min(1).max(255).allow('')
}).unknown(false)

let providedOptions: ApiKeyPluginOptions

const plugin: Plugin<ApiKeyPluginOptions> = {
  name: 'hapi-api-key-auth',
  register: async function (server: Server, options: ApiKeyPluginOptions = {}) {
    const { error, value } = optionsSchema.validate(options)

    if (error) {
      throw new Error(`Invalid plugin options: ${error.message}`)
    }

    const mergedOptions = applyToDefaults(defaultOptions, value)

    const hasHeader = mergedOptions.headerName && mergedOptions.headerName.length > 0
    const hasQuery = mergedOptions.queryParamName && mergedOptions.queryParamName.length > 0

    if (!hasHeader && !hasQuery) {
      throw new Error('Invalid plugin options: At least one of "headerName" or "queryParamName" must be specified and non-empty')
    }

    providedOptions = Object.freeze(mergedOptions)
    server.auth.scheme('api-key', () => ({ authenticate }))
  }
}

async function authenticate (request: Request, h: ResponseToolkit) {
  const supportedApiKeys = await getSupportedApiKeys(request)
  const providedApiKeys = getProvidedApiKeys(request)
  const matchingApiKeys = providedApiKeys.filter(providedKey =>
    supportedApiKeys.some(supportedKey => timingSafeCompare(providedKey, supportedKey))
  )

  if (matchingApiKeys.length === 0) {
    throw unauthorized('Invalid API key')
  }

  return h.authenticated({ credentials: { apiKey: matchingApiKeys[0] } })
}

async function getSupportedApiKeys (request: Request): Promise<string[]> {
  const { apiKey } = providedOptions

  if (typeof apiKey === 'function') {
    const result = await apiKey(request)
    return normalizeToStringArray(result, '"apiKey" function must return a string or an array of strings')
  }

  return normalizeToStringArray(apiKey!, '"apiKey" must be a string or an array of strings')
}

function normalizeToStringArray (value: string | string[], errorMessage: string): string[] {
  if (Array.isArray(value) && value.every(v => typeof v === 'string' && v.length > 0 && v.length < 256)) {
    return value
  }
  if (typeof value === 'string' && value.length > 0 && value.length < 256) {
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

function timingSafeCompare (a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)

  if (bufA.length !== bufB.length) {
    const dummy = Buffer.alloc(bufA.length)
    crypto.timingSafeEqual(bufA, dummy)
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}

export default plugin

export type { ApiKeyPluginOptions }
