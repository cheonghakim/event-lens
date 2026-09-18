import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSocketAdapter } from '../src/data-source/WebSocketAdapter.js'

class MockWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = 0 // CONNECTING
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    MockWebSocket.instances.push(this)
  }

  close() {
    this.readyState = 3 // CLOSED
    this.onclose?.({})
  }

  // test helpers simulating server/browser behavior
  _open() {
    this.readyState = 1 // OPEN
    this.onopen?.({})
  }

  _receive(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }

  _receiveRaw(data) {
    this.onmessage?.({ data })
  }
}

describe('WebSocketAdapter', () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('connects to the given URL on subscribe', () => {
    const ds = new WebSocketAdapter({ url: 'wss://example.com/stream' })
    ds.subscribe(vi.fn())
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('wss://example.com/stream')
  })

  it('dispatches events wrapped as { type: "events", data: [...] }', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockWebSocket.instances[0]._receive({ type: 'events', data: [{ id: '1' }, { id: '2' }] })
    expect(cb).toHaveBeenCalledWith([{ id: '1' }, { id: '2' }])
  })

  it('dispatches a single event wrapped as { type: "event", data: {...} }', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockWebSocket.instances[0]._receive({ type: 'event', data: { id: '1' } })
    expect(cb).toHaveBeenCalledWith([{ id: '1' }])
  })

  it('dispatches a bare event object (id + timestamp) without a type wrapper', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockWebSocket.instances[0]._receive({ id: '1', timestamp: '2026-01-01T00:00:00Z' })
    expect(cb).toHaveBeenCalledWith([{ id: '1', timestamp: '2026-01-01T00:00:00Z' }])
  })

  it('ignores malformed (non-JSON) messages without throwing', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    expect(() => MockWebSocket.instances[0]._receiveRaw('not json{{{')).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('uses a custom messageMapper when provided', () => {
    const messageMapper = vi.fn(raw => [{ id: raw.customId }])
    const ds = new WebSocketAdapter({ url: 'wss://x', messageMapper })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockWebSocket.instances[0]._receive({ customId: 'abc' })
    expect(messageMapper).toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith([{ id: 'abc' }])
  })

  it('reconnects after reconnectMs when the socket closes unexpectedly', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x', reconnectMs: 5000 })
    ds.subscribe(vi.fn())
    expect(MockWebSocket.instances).toHaveLength(1)

    MockWebSocket.instances[0].close()
    expect(MockWebSocket.instances).toHaveLength(1) // not yet — timer pending

    vi.advanceTimersByTime(5000)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('does not reconnect when reconnect: false', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x', reconnect: false, reconnectMs: 1000 })
    ds.subscribe(vi.fn())
    MockWebSocket.instances[0].close()
    vi.advanceTimersByTime(10000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('does not reconnect after destroy()', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x', reconnectMs: 1000 })
    ds.subscribe(vi.fn())
    ds.destroy()
    vi.advanceTimersByTime(10000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('does not reconnect after unsubscribe()', () => {
    const ds = new WebSocketAdapter({ url: 'wss://x', reconnectMs: 1000 })
    ds.subscribe(vi.fn())
    ds.unsubscribe()
    vi.advanceTimersByTime(10000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('getRows() loads initial data via the initial() function and paginates', async () => {
    const initial = vi.fn(async () => [{ id: '1' }, { id: '2' }, { id: '3' }])
    const ds = new WebSocketAdapter({ url: 'wss://x', initial })
    const result = await ds.getRows({ start: 0, end: 1 })
    expect(initial).toHaveBeenCalledTimes(1)
    expect(result.rows).toEqual([{ id: '1' }, { id: '2' }])
    expect(result.totalCount).toBe(3)
  })

  it('prepends incoming live events to the initial row cache', async () => {
    const initial = vi.fn(async () => [{ id: 'old' }])
    const ds = new WebSocketAdapter({ url: 'wss://x', initial })
    await ds.getRows({ start: 0, end: 10 })
    ds.subscribe(vi.fn())
    MockWebSocket.instances[0]._receive({ id: 'new', timestamp: 't' })
    const result = await ds.getRows({ start: 0, end: 10 })
    expect(result.rows.map(r => r.id)).toEqual(['new', 'old'])
  })
})
