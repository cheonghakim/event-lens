import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LiveController } from '../src/live/LiveController.js'
import { EventBus } from '../src/core/EventBus.js'
import { buildFilterFn } from '../src/filter/filterUtils.js'

function makeCore({ liveOpts = {}, dataSource = {}, filter = null, grid = null } = {}) {
  const bus = new EventBus()
  return {
    _bus: bus,
    _options: { live: { enabled: true, flushInterval: 1000, maxBufferSize: 100, ...liveOpts } },
    _dataSource: {
      subscribe:   vi.fn(),
      unsubscribe: vi.fn(),
      pushLiveEvents: vi.fn(),
      ...dataSource,
    },
    _filterEngine: {
      getFilter: () => filter,
      buildFilterFn: (cfg) => buildFilterFn(cfg),
    },
    _grid: grid ?? { prependRows: vi.fn() },
  }
}

function withController(coreOpts) {
  const core = makeCore(coreOpts)
  const controller = new LiveController(core)
  return { core, controller }
}

describe('LiveController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does nothing on start() when live mode is disabled', () => {
    const { core, controller } = withController({ liveOpts: { enabled: false } })
    controller.start()
    expect(core._dataSource.subscribe).not.toHaveBeenCalled()
  })

  it('subscribes to the data source and emits live:connected on start()', () => {
    const { core, controller } = withController()
    const onConnected = vi.fn()
    core._bus.on('live:connected', onConnected)

    controller.start()

    expect(core._dataSource.subscribe).toHaveBeenCalledTimes(1)
    expect(onConnected).toHaveBeenCalledTimes(1)
  })

  it('buffers incoming events and flushes them to the grid and data source', () => {
    const { core, controller } = withController()
    controller.start()
    const onNewEvents = vi.fn()
    core._bus.on('live:new-events', onNewEvents)

    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]
    onIncoming([{ id: '1', severity: 'critical' }, { id: '2', severity: 'low' }])

    expect(core._grid.prependRows).not.toHaveBeenCalled() // not flushed yet

    controller._flush()

    expect(core._dataSource.pushLiveEvents).toHaveBeenCalledWith([
      { id: '1', severity: 'critical' },
      { id: '2', severity: 'low' },
    ])
    expect(core._grid.prependRows).toHaveBeenCalledWith([
      { id: '1', severity: 'critical' },
      { id: '2', severity: 'low' },
    ])
    expect(onNewEvents).toHaveBeenCalledWith({
      events: [{ id: '1', severity: 'critical' }, { id: '2', severity: 'low' }],
      count: 2,
    })
  })

  it('pushes ALL buffered events to the data source but only filter-matching events to the grid', () => {
    const { core, controller } = withController({ filter: { severity: ['critical'] } })
    controller.start()
    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]
    onIncoming([{ id: '1', severity: 'critical' }, { id: '2', severity: 'low' }])

    controller._flush()

    expect(core._dataSource.pushLiveEvents).toHaveBeenCalledWith([
      { id: '1', severity: 'critical' },
      { id: '2', severity: 'low' },
    ])
    expect(core._grid.prependRows).toHaveBeenCalledWith([{ id: '1', severity: 'critical' }])
  })

  it('does not emit live:new-events or touch the grid when no buffered event matches the filter', () => {
    const { core, controller } = withController({ filter: { severity: ['critical'] } })
    controller.start()
    const onNewEvents = vi.fn()
    core._bus.on('live:new-events', onNewEvents)
    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]
    onIncoming([{ id: '1', severity: 'low' }])

    controller._flush()

    expect(core._dataSource.pushLiveEvents).toHaveBeenCalled() // still pushed to data source
    expect(core._grid.prependRows).not.toHaveBeenCalled()
    expect(onNewEvents).not.toHaveBeenCalled()
  })

  it('evicts the oldest buffered events and emits live:events-dropped when over maxBufferSize', () => {
    const { core, controller } = withController({ liveOpts: { maxBufferSize: 3 } })
    controller.start()
    const onDropped = vi.fn()
    core._bus.on('live:events-dropped', onDropped)
    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]

    onIncoming([{ id: '1' }, { id: '2' }, { id: '3' }])
    onIncoming([{ id: '4' }, { id: '5' }]) // buffer would be 5, cap is 3 -> drop 2 oldest

    expect(onDropped).toHaveBeenCalledWith({ count: 2 })

    controller._flush()
    expect(core._dataSource.pushLiveEvents).toHaveBeenCalledWith([{ id: '3' }, { id: '4' }, { id: '5' }])
  })

  it('does not flush while paused, and flushes immediately on resume()', () => {
    const { core, controller } = withController()
    controller.start()
    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]

    controller.pause()
    onIncoming([{ id: '1' }])
    controller._flush()
    expect(core._dataSource.pushLiveEvents).not.toHaveBeenCalled()

    controller.resume()
    expect(core._dataSource.pushLiveEvents).toHaveBeenCalledWith([{ id: '1' }])
  })

  it('emits live:paused / live:resumed', () => {
    const { core, controller } = withController()
    const onPaused = vi.fn()
    const onResumed = vi.fn()
    core._bus.on('live:paused', onPaused)
    core._bus.on('live:resumed', onResumed)

    controller.pause()
    expect(controller.isPaused()).toBe(true)
    expect(onPaused).toHaveBeenCalled()

    controller.resume()
    expect(controller.isPaused()).toBe(false)
    expect(onResumed).toHaveBeenCalled()
  })

  it('flushes automatically on the flushInterval timer', () => {
    const { core, controller } = withController({ liveOpts: { flushInterval: 1000 } })
    controller.start()
    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]
    onIncoming([{ id: '1' }])

    vi.advanceTimersByTime(999)
    expect(core._dataSource.pushLiveEvents).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(core._dataSource.pushLiveEvents).toHaveBeenCalledWith([{ id: '1' }])
  })

  it('stop() clears the flush timer, unsubscribes, and emits live:disconnected', () => {
    const { core, controller } = withController()
    controller.start()
    const onDisconnected = vi.fn()
    core._bus.on('live:disconnected', onDisconnected)

    controller.stop()

    expect(core._dataSource.unsubscribe).toHaveBeenCalledTimes(1)
    expect(onDisconnected).toHaveBeenCalledTimes(1)

    const onIncoming = core._dataSource.subscribe.mock.calls[0][0]
    onIncoming([{ id: '1' }])
    vi.advanceTimersByTime(10000)
    expect(core._dataSource.pushLiveEvents).not.toHaveBeenCalled() // timer was cleared
  })

  it('destroy() delegates to stop()', () => {
    const { core, controller } = withController()
    controller.start()
    controller.destroy()
    expect(core._dataSource.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('live:pause and live:resume bus events toggle pause state', () => {
    const { core, controller } = withController()
    controller.start()

    core._bus.emit('live:pause', {})
    expect(controller.isPaused()).toBe(true)

    core._bus.emit('live:resume', {})
    expect(controller.isPaused()).toBe(false)
  })
})
