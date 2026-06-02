import { StaticArrayAdapter }   from './StaticArrayAdapter.js'
import { AsyncFunctionAdapter } from './AsyncFunctionAdapter.js'
import { ServerRangeAdapter }   from './ServerRangeAdapter.js'
import { WebSocketAdapter }     from './WebSocketAdapter.js'
import { SSEAdapter }           from './SSEAdapter.js'

export function createDataSource(dataSource) {
  // ── Array → StaticArrayAdapter
  if (Array.isArray(dataSource)) {
    return new StaticArrayAdapter(dataSource)
  }

  // ── Function → AsyncFunctionAdapter
  if (typeof dataSource === 'function') {
    return new AsyncFunctionAdapter(dataSource)
  }

  if (dataSource && typeof dataSource === 'object') {
    // ── Already a valid adapter (has getRows method)
    if (typeof dataSource.getRows === 'function') {
      return dataSource
    }

    // ── Config object with type discriminator
    const { type } = dataSource

    if (type === 'server-range') {
      return new ServerRangeAdapter(dataSource)
    }

    if (type === 'websocket' || type === 'ws') {
      return new WebSocketAdapter(dataSource)
    }

    if (type === 'sse') {
      return new SSEAdapter(dataSource)
    }
  }

  throw new Error(
    '[TraceScope] Invalid dataSource. Expected an array, async function, adapter object, ' +
    'or config with type: "server-range" | "websocket" | "sse".'
  )
}
