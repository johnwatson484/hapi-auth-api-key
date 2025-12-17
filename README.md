![Build](https://github.com/johnwatson484/hapi-auth-api-key/actions/workflows/publish.yaml/badge.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-auth-api-key&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_hapi-auth-api-key)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-auth-api-key&metric=bugs)](https://sonarcloud.io/summary/new_code?id=DEFRA_hapi-auth-api-key)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-auth-api-key&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=DEFRA_hapi-auth-api-key)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-auth-api-key&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=DEFRA_hapi-auth-api-key)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_hapi-auth-api-key&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_hapi-auth-api-key)
[![Known Vulnerabilities](https://snyk.io/test/github/johnwatson484/hapi-auth-api-key/badge.svg)](https://snyk.io/test/github/johnwatson484/hapi-auth-api-key)

# hapi-auth-api-key
API Key authentication strategy for Hapi.js

## Installation

```bash
npm install hapi-auth-api-key
```

## Usage

```javascript
import Hapi from '@hapi/hapi'
import HapiAuthApiKey from 'hapi-auth-api-key'

const VALID_API_KEY = process.env.API_KEY || 'your-secret-api-key'

const init = async () => {

  const server = Hapi.server({
    port: 3000,
    host: 'localhost'
  })

  await server.register({
    plugin: HapiAuthApiKey, options: { apiKey: VALID_API_KEY }
  })

  server.auth.strategy('api-key', 'api-key')

  server.route({
    method: 'GET',
    path: '/',
    options: {
      auth: 'api-key'
    },
    handler: (request, h) => {
      console.log('Authenticated request with API key:', request.auth.credentials.apiKey)
      return 'Hello World!'
    }
  })

  await server.start()
  console.log('Server running on %s', server.info.uri)
}

process.on('unhandledRejection', (err) => {

  console.log(err)
  process.exit(1)
})

init()
```

By default, the plugin expects clients to send the API key in the `x-api-key` header with each request:

```bash
curl -H "x-api-key: your-secret-api-key" http://localhost:3000/
```

Alternatively, you can configure the plugin to accept the API key as a query parameter by setting the `queryParamName` option.

## Options

The plugin accepts the following options during registration:

### `apiKey` (required)

The API key(s) that are valid for authentication. Can be:

- **String**: A single API key
  ```javascript
  { apiKey: 'your-secret-api-key' }
  ```

- **Array of strings**: Multiple valid API keys
  ```javascript
  { apiKey: ['key-1', 'key-2', 'key-3'] }
  ```

- **Function**: A function that receives the request and returns a string or array of strings
  ```javascript
  { apiKey: (request) => request.headers['x-tenant-id'] === 'tenant-a' ? 'key-a' : 'key-b' }
  ```

- **Promise**: A promise that resolves to a string or array of strings
  ```javascript
  { apiKey: fetchApiKeysFromDatabase() }
  ```

### `headerName` (optional)

The name of the header to check for the API key. Defaults to `x-api-key`.

```javascript
{ headerName: 'authorization' }
```

### `queryParamName` (optional)

The name of the query parameter to check for the API key. Defaults to `api-key`.

```javascript
{ queryParamName: 'key' }
```

**Note:** At least one of `headerName` or `queryParamName` must be specified (or left as default).
