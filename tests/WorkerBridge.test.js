import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WorkerBridge } from '../src/worker/WorkerBridge.js'

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

class MockWorker {
  static instances = []

  constructor(url, opts) {
    this.url = url
    this.opts = opts
    this.onmessage = null
    this.onerror = null
    this.terminated = false
    this.posted = []
    MockWorker.instances.push(this)
  }

  postMessage(msg) {
    this.posted.push(msg)
  }

  terminate() {
    this.terminated = true
  }

  // test helpers
  _respondSuccess(id, result) {
    this.onmessage?.({ data: { id, success: true, result } })
  }

  _respondError(id, error) {
    this.onmessage?.({ data: { id, success: false, error } })
  }

  _pushLive(events, totalCount) {
    this.onmessage?.({ data: { type: 'live-push', events, totalCount } })
  }
}

function makeAdapter(overrides = {}) {
  return {
    getRows:    vi.fn(async () => ({ rows: [{ id: '1' }], totalCount: 1 })),
    getRowById: vi.fn(async () => ({ id: '1' })),
    getTotalCount: vi.fn(() => 1),
    applyFilter: vi.fn(),
    applySort:   vi.fn(),
    subscribe:   vi.fn(),
    unsubscribe: vi.fn(),
    pushLiveEvents: vi.fn(),
    isServerSide: vi.fn(() => false),
    ...overrides,
  }
}

describe('WorkerBridge — no Worker support (fallback path)', () => {
  beforeEach(() => vi.stubGlobal('Worker', undefined))
  afterEach(() => vi.unstubAllGlobals())

  it('falls back to the adapter for every DataSource method', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter)
    await flush()

    expect(bridge.isWorkerActive()).toBe(false)

    await bridge.getRows({ start: 0, end: 0 })
    expect(adapter.getRows).toHaveBeenCalled()

    await bridge.getRowById('1')
    expect(adapter.getRowById).toHaveBeenCalledWith('1')

    expect(bridge.getTotalCount()).toBe(1)

    await bridge.applyFilter({ severity: ['high'] })
    expect(adapter.applyFilter).toHaveBeenCalledWith({ severity: ['high'] })

    await bridge.pushLiveEvents([{ id: '2' }])
    expect(adapter.pushLiveEvents).toHaveBeenCalledWith([{ id: '2' }])

    const cb = vi.fn()
    bridge.subscribe(cb)
    expect(adapter.subscribe).toHaveBeenCalledWith(cb)

    bridge.unsubscribe()
    expect(adapter.unsubscribe).toHaveBeenCalled()
  })
})

describe('WorkerBridge — with a Worker available', () => {
  beforeEach(() => {
    MockWorker.instances = []
    vi.stubGlobal('Worker', MockWorker)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('initializes the worker with the adapter data and switches to worker mode on success', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter, { maxTotalRows: 500 })
    await flush()

    const worker = MockWorker.instances[0]
    const initMsg = worker.posted.find(m => m.type === 'init')
    expect(initMsg).toBeTruthy()
    expect(initMsg.payload.data).toEqual([{ id: '1' }])
    expect(initMsg.payload.maxRows).toBe(500)

    worker._respondSuccess(initMsg.id, { totalCount: 1 })
    await flush()

    expect(bridge.isWorkerActive()).toBe(true)
    expect(bridge.getTotalCount()).toBe(1)
  })

  it('delegates getRows/applyFilter to the worker via postMessage once active', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter)
    await flush()
    const worker = MockWorker.instances[0]
    const initMsg = worker.posted.find(m => m.type === 'init')
    worker._respondSuccess(initMsg.id, {})
    await flush()

    const getRowsPromise = bridge.getRows({ start: 0, end: 9 })
    const getRowsMsg = worker.posted.find(m => m.type === 'getRows')
    worker._respondSuccess(getRowsMsg.id, { rows: [{ id: 'x' }], totalCount: 1 })
    await expect(getRowsPromise).resolves.toEqual({ rows: [{ id: 'x' }], totalCount: 1 })

    const filterPromise = bridge.applyFilter({ severity: ['high'] })
    const filterMsg = worker.posted.find(m => m.type === 'applyFilter')
    expect(filterMsg.payload.filter).toEqual({ severity: ['high'] })
    worker._respondSuccess(filterMsg.id, { totalCount: 3 })
    await filterPromise
    expect(bridge.getTotalCount()).toBe(3)
  })

  it('delivers proactive live-push messages from the worker to the subscribed callback', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter)
    await flush()
    const worker = MockWorker.instances[0]
    const initMsg = worker.posted.find(m => m.type === 'init')
    worker._respondSuccess(initMsg.id, {})
    await flush()

    const cb = vi.fn()
    bridge.subscribe(cb)
    worker._pushLive([{ id: 'live-1' }], 5)

    expect(cb).toHaveBeenCalledWith([{ id: 'live-1' }])
    expect(bridge.getTotalCount()).toBe(5)
  })

  it('falls back to the adapter if worker data initialization fails', async () => {
    let callCount = 0
    const adapter = makeAdapter({
      getRows: vi.fn(async () => {
        callCount++
        if (callCount === 1) throw new Error('boom') // fails only during worker init
        return { rows: [{ id: '1' }], totalCount: 1 }
      }),
    })
    const bridge = new WorkerBridge(adapter)
    await flush()

    expect(bridge.isWorkerActive()).toBe(false)
    expect(MockWorker.instances[0].terminated).toBe(true)

    await bridge.getRows({ start: 0, end: 0 })
    expect(adapter.getRows).toHaveBeenCalledTimes(2) // once during failed init, once via fallback
  })

  it('rejects pending requests and stops using the worker on a runtime error', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter)
    await flush()
    const worker = MockWorker.instances[0]
    const initMsg = worker.posted.find(m => m.type === 'init')
    worker._respondSuccess(initMsg.id, {})
    await flush()

    const getRowsPromise = bridge.getRows({ start: 0, end: 0 })
    worker.onerror?.({ message: 'worker crashed' })

    await expect(getRowsPromise).rejects.toThrow('worker crashed')
    expect(bridge.isWorkerActive()).toBe(false)
  })

  it('destroy() terminates the worker and rejects any in-flight requests', async () => {
    const adapter = makeAdapter()
    const bridge = new WorkerBridge(adapter)
    await flush()
    const worker = MockWorker.instances[0]
    const initMsg = worker.posted.find(m => m.type === 'init')
    worker._respondSuccess(initMsg.id, {})
    await flush()

    const pending = bridge.getRows({ start: 0, end: 0 })
    bridge.destroy()

    await expect(pending).rejects.toThrow('WorkerBridge destroyed')
    expect(worker.terminated).toBe(true)
  })
})
