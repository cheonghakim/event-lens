import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SSEAdapter } from '../src/data-source/SSEAdapter.js'

class MockEventSource {
  static instances = []

  constructor(url, opts) {
    this.url = url
    this.opts = opts
    this.onmessage = null
    this.onerror = null
    this._listeners = {}
    MockEventSource.instances.push(this)
  }

  addEventListener(name, handler) {
    this._listeners[name] = handler
  }

  close() {
    this.closed = true
  }

  // test helpers
  _emit(name, payload) {
    const data = JSON.stringify(payload)
    if (name === 'message') this.onmessage?.({ data })
    else this._listeners[name]?.({ data })
  }

  _emitRaw(name, data) {
    if (name === 'message') this.onmessage?.({ data })
    else this._listeners[name]?.({ data })
  }
}

describe('SSEAdapter', () => {
  beforeEach(() => {
    MockEventSource.instances = []
    vi.stubGlobal('EventSource', MockEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('connects to the given URL on subscribe', () => {
    const ds = new SSEAdapter({ url: 'https://example.com/stream' })
    ds.subscribe(vi.fn())
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('https://example.com/stream')
  })

  it('passes withCredentials through to EventSource', () => {
    const ds = new SSEAdapter({ url: 'https://x', withCredentials: true })
    ds.subscribe(vi.fn())
    expect(MockEventSource.instances[0].opts).toEqual({ withCredentials: true })
  })

  it('dispatches on the default "message" event when eventName is not set', () => {
    const ds = new SSEAdapter({ url: 'https://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockEventSource.instances[0]._emit('message', { id: '1', timestamp: 't' })
    expect(cb).toHaveBeenCalledWith([{ id: '1', timestamp: 't' }])
  })

  it('dispatches on a custom named event when eventName is set', () => {
    const ds = new SSEAdapter({ url: 'https://x', eventName: 'security-event' })
    const cb = vi.fn()
    ds.subscribe(cb)
    // the default 'message' handler must NOT be wired when a custom eventName is used
    expect(MockEventSource.instances[0].onmessage).toBeNull()
    MockEventSource.instances[0]._emit('security-event', { id: '1', timestamp: 't' })
    expect(cb).toHaveBeenCalledWith([{ id: '1', timestamp: 't' }])
  })

  it('unwraps { event: { id, ... } } payloads via the default mapper', () => {
    const ds = new SSEAdapter({ url: 'https://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockEventSource.instances[0]._emit('message', { event: { id: '1' } })
    expect(cb).toHaveBeenCalledWith([{ id: '1' }])
  })

  it('ignores malformed (non-JSON) messages without throwing', () => {
    const ds = new SSEAdapter({ url: 'https://x' })
    const cb = vi.fn()
    ds.subscribe(cb)
    expect(() => MockEventSource.instances[0]._emitRaw('message', 'not json{{{')).not.toThrow()
    expect(cb).not.toHaveBeenCalled()
  })

  it('uses a custom messageMapper when provided', () => {
    const messageMapper = vi.fn(raw => [{ id: raw.customId }])
    const ds = new SSEAdapter({ url: 'https://x', messageMapper })
    const cb = vi.fn()
    ds.subscribe(cb)
    MockEventSource.instances[0]._emit('message', { customId: 'abc' })
    expect(messageMapper).toHaveBeenCalled()
    expect(cb).toHaveBeenCalledWith([{ id: 'abc' }])
  })

  it('closes the underlying EventSource on unsubscribe', () => {
    const ds = new SSEAdapter({ url: 'https://x' })
    ds.subscribe(vi.fn())
    ds.unsubscribe()
    expect(MockEventSource.instances[0].closed).toBe(true)
  })

  it('closes the underlying EventSource on destroy', () => {
    const ds = new SSEAdapter({ url: 'https://x' })
    ds.subscribe(vi.fn())
    ds.destroy()
    expect(MockEventSource.instances[0].closed).toBe(true)
  })

  it('getRows() loads initial data via the initial() function and paginates', async () => {
    const initial = vi.fn(async () => ({ rows: [{ id: '1' }, { id: '2' }], totalCount: 2 }))
    const ds = new SSEAdapter({ url: 'https://x', initial })
    const result = await ds.getRows({ start: 0, end: 0 })
    expect(initial).toHaveBeenCalledTimes(1)
    expect(result.rows).toEqual([{ id: '1' }])
    expect(result.totalCount).toBe(2)
  })
})
