# @vafast/opentelemetry

Plugin for [Vafast](https://github.com/vafastjs/vafast) for OpenTelemetry integration.

## Installation

```bash
bun add @vafast/opentelemetry
# or
npm install @vafast/opentelemetry
```

## Example

```typescript
import { Server, createHandler } from 'vafast'
import { opentelemetry } from '@vafast/opentelemetry'

const otelMiddleware = opentelemetry({
  serviceName: 'my-vafast-app'
})

const routes = [
  {
    method: 'GET',
    path: '/',
    middleware: [otelMiddleware],
    handler: createHandler(() => {
      return { message: 'Hello World' }
    })
  }
]

const server = new Server(routes)

export default {
  fetch: (req: Request) => server.fetch(req)
}
```

## Configuration

### serviceName

@default `'vafast-app'`

Service name for OpenTelemetry

### instrumentations

Array of OpenTelemetry instrumentations to use

## License

MIT
