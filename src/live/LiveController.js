export class LiveController {
  constructor(core) {
    this._core       = core
    this._bus        = core._bus
    this._opts       = core._options.live
    this._dataSource = core._dataSource
    this._paused     = false
    this._buffer     = []
    this._flushTimer = null
    this._connected  = false
  }

  start() {
    if (!this._opts.enabled) return

    if (typeof this._dataSource.subscribe === 'function') {
      this._dataSource.subscribe(this._onIncomingEvents.bind(this))
      this._connected = true
      this._bus.emit('live:connected', {})
    }

    this._flushTimer = setInterval(() => this._flush(), this._opts.flushInterval)

    this._bus.on('live:pause',  () => this.pause())
    this._bus.on('live:resume', () => this.resume())
  }

  pause() {
    this._paused = true
    this._bus.emit('live:paused', {})
  }

  resume() {
    this._paused = false
    this._bus.emit('live:resumed', {})
    this._flush()
  }

  stop() {
    clearInterval(this._flushTimer)
    if (typeof this._dataSource.unsubscribe === 'function') {
      this._dataSource.unsubscribe()
    }
    this._connected = false
    this._bus.emit('live:disconnected', {})
  }

  isPaused() {
    return this._paused
  }

  _onIncomingEvents(events) {
    if (!Array.isArray(events)) events = [events]

    if (this._buffer.length + events.length > this._opts.maxBufferSize) {
      const excess = (this._buffer.length + events.length) - this._opts.maxBufferSize
      this._buffer.splice(0, excess)
      this._bus.emit('live:events-dropped', { count: excess })
    }

    this._buffer.push(...events)
  }

  _flush() {
    if (this._paused || this._buffer.length === 0) return

    const batch = this._buffer.splice(0)

    // Push ALL events to data source — StaticArrayAdapter re-applies current filter internally
    if (typeof this._dataSource.pushLiveEvents === 'function') {
      this._dataSource.pushLiveEvents(batch)
    }

    // Determine which events are visible (match current filter) for grid display
    const filterFn = this._core._filterEngine?.buildFilterFn(
      this._core._filterEngine.getFilter()
    ) ?? null
    const visible = filterFn ? batch.filter(filterFn) : batch

    if (visible.length === 0) return

    this._bus.emit('live:new-events', { events: visible, count: visible.length })
    this._core._grid?.prependRows(visible)
  }

  destroy() {
    this.stop()
  }
}
