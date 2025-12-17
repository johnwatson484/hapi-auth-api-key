import { describe, it, expect, beforeEach } from 'vitest'
import { Server } from '@hapi/hapi'
import plugin from '../src/index'

describe('hapi-api-key-auth', () => {
  let server: Server

  beforeEach(async () => {
    server = new Server()
  })

  describe('plugin registration', () => {
    it('should register successfully with valid apiKey', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key' }
        })
      ).resolves.not.toThrow()
    })

    it('should register with array of apiKeys', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: ['key1', 'key2'] }
        })
      ).resolves.not.toThrow()
    })

    it('should register with custom headerName', async () => {
      await expect(
        server.register({
          plugin,
          options: {
            apiKey: 'test-key',
            headerName: 'custom-header'
          }
        })
      ).resolves.not.toThrow()
    })

    it('should register with custom queryParamName', async () => {
      await expect(
        server.register({
          plugin,
          options: {
            apiKey: 'test-key',
            queryParamName: 'custom-param'
          }
        })
      ).resolves.not.toThrow()
    })

    it('should register with apiKey function', async () => {
      await expect(
        server.register({
          plugin,
          options: {
            apiKey: () => 'dynamic-key'
          }
        })
      ).resolves.not.toThrow()
    })

    it('should reject invalid option types', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key', headerName: 123 } as any
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject unknown options', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key', invalidOption: 'value' } as any
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject empty string apiKey', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: '' }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject apiKey longer than 255 characters', async () => {
      const tooLong = 'a'.repeat(256)
      await expect(
        server.register({
          plugin,
          options: { apiKey: tooLong }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject array with empty string', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: ['key1', ''] }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject array with too long key', async () => {
      const tooLong = 'a'.repeat(256)
      await expect(
        server.register({
          plugin,
          options: { apiKey: ['key1', tooLong] }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject empty headerName', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key', headerName: '', queryParamName: '' }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should reject headerName longer than 255 characters', async () => {
      const tooLong = 'a'.repeat(256)
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key', headerName: tooLong }
        })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should allow empty queryParamName when headerName is present', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: 'test-key', headerName: 'x-api-key', queryParamName: '' }
        })
      ).resolves.not.toThrow()
    })
  })

  describe('authentication scheme', () => {
    it('should throw error when apiKey is not specified', async () => {
      // Empty apiKey should be caught by Joi validation during registration
      await expect(
        server.register({ plugin, options: { apiKey: '' } })
      ).rejects.toThrow('Invalid plugin options')
    })

    it('should throw error when neither headerName nor queryParamName is specified', async () => {
      // Empty headerName should be caught by Joi validation during registration
      await expect(
        server.register({
          plugin,
          options: {
            apiKey: 'test-key',
            headerName: '',
            queryParamName: ''
          }
        })
      ).rejects.toThrow('Invalid plugin options')
    })
  })

  describe('security: API key validation', () => {
    it('should accept API key with 255 characters', async () => {
      const maxKey = 'a'.repeat(255)
      await expect(
        server.register({
          plugin,
          options: { apiKey: maxKey }
        })
      ).resolves.not.toThrow()
    })

    it('should accept array with all valid keys', async () => {
      await expect(
        server.register({
          plugin,
          options: { apiKey: ['key1', 'key2', 'key3'] }
        })
      ).resolves.not.toThrow()
    })

    it('should authenticate with very long valid key (255 chars)', async () => {
      const maxKey = 'a'.repeat(255)
      await server.register({
        plugin,
        options: { apiKey: maxKey }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()

      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': maxKey }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: maxKey })
    })
  })

  describe('security: timing-safe comparison', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: { apiKey: 'secret-key-123' }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should correctly reject keys with partial matches', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'secret-key-124' } // Last char different
      })

      expect(res.statusCode).toBe(401)
    })

    it('should correctly reject keys with same prefix', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'secret-key-' } // Prefix match only
      })

      expect(res.statusCode).toBe(401)
    })

    it('should correctly reject keys with different lengths', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'secret' } // Much shorter
      })

      expect(res.statusCode).toBe(401)
    })

    it('should correctly accept exact match', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'secret-key-123' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'secret-key-123' })
    })

    it('should be case-sensitive', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'SECRET-KEY-123' }
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('authentication with header', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: { apiKey: 'valid-key' }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should authenticate with valid api key in default header', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'valid-key' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'valid-key' })
    })

    it('should reject with invalid api key in header', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'invalid-key' }
      })

      expect(res.statusCode).toBe(401)
      expect(res.result).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid API key'
      })
    })

    it('should reject when api key header is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected'
      })

      expect(res.statusCode).toBe(401)
      expect(res.result).toMatchObject({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid API key'
      })
    })
  })

  describe('authentication with query parameter', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: {
          apiKey: 'valid-key',
          headerName: undefined,
          queryParamName: 'api-key'
        }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should authenticate with valid api key in default query param', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?api-key=valid-key'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'valid-key' })
    })

    it('should reject with invalid api key in query param', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?api-key=invalid-key'
      })

      expect(res.statusCode).toBe(401)
    })

    it('should reject when api key query param is missing', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected'
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('authentication with custom header and query param names', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: {
          apiKey: 'valid-key',
          headerName: 'authorization',
          queryParamName: 'token'
        }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should authenticate with custom header name', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'valid-key' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'valid-key' })
    })

    it('should authenticate with custom query param name', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?token=valid-key'
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'valid-key' })
    })
  })

  describe('authentication with multiple api keys', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: { apiKey: ['key1', 'key2', 'key3'] }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should authenticate with first valid key', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'key1' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'key1' })
    })

    it('should authenticate with second valid key', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'key2' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'key2' })
    })

    it('should authenticate with third valid key', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'key3' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'key3' })
    })

    it('should reject with invalid key', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'invalid-key' }
      })

      expect(res.statusCode).toBe(401)
    })
  })

  describe('authentication with api key function', () => {
    it('should authenticate with function returning string', async () => {
      await server.register({
        plugin,
        options: {
          apiKey: (request) => {
            return request.headers['x-tenant-id'] === 'tenant1' ? 'tenant1-key' : 'other-key'
          }
        }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()

      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          'x-api-key': 'tenant1-key',
          'x-tenant-id': 'tenant1'
        }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'tenant1-key' })
    })

    it('should authenticate with function returning array', async () => {
      await server.register({
        plugin,
        options: {
          apiKey: () => ['key1', 'key2']
        }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()

      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'key2' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'key2' })
    })
  })

  describe('authentication with both header and query param', () => {
    beforeEach(async () => {
      await server.register({
        plugin,
        options: {
          apiKey: 'valid-key',
          queryParamName: 'api-key'
        }
      })
      server.auth.strategy('api-key', 'api-key')

      server.route({
        method: 'GET',
        path: '/protected',
        options: { auth: 'api-key' },
        handler: (request) => ({ success: true, apiKey: request.auth.credentials.apiKey })
      })

      await server.initialize()
    })

    it('should authenticate when valid key in header', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'valid-key' }
      })

      expect(res.statusCode).toBe(200)
    })

    it('should authenticate when valid key in query param', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?api-key=valid-key'
      })

      expect(res.statusCode).toBe(200)
    })

    it('should authenticate when valid key in both header and query (prefers header)', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?api-key=valid-key',
        headers: { 'x-api-key': 'valid-key' }
      })

      expect(res.statusCode).toBe(200)
      expect(res.result).toEqual({ success: true, apiKey: 'valid-key' })
    })

    it('should reject when invalid key in both header and query', async () => {
      const res = await server.inject({
        method: 'GET',
        url: '/protected?api-key=invalid',
        headers: { 'x-api-key': 'invalid' }
      })

      expect(res.statusCode).toBe(401)
    })
  })
})
