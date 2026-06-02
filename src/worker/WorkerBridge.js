/**
 * WorkerBridge — main thread wrapper around DataWorker.
 * Provides the same DataSource adapter interface as StaticArrayAdapter,
 * but delegates all operations to the Worker via postMessage.
 *
 * Falls back transparently to the provided adapter if:
 *   - Web Workers are not supported
 *   - Worker fails to initialize
 */
export class WorkerBridge {
  constructor(adapter, options = {}) {
    this._adapter      = adapter    // fallback adapter (main thread)
    this._options      = options
    this._worker       = null
    this._pending      = new Map()  // id → { resolve, reject }
    this._msgId        = 0
    this._ready        = false
    this._useWorker    = false
    this._liveCallback = null
    this._totalCount   = 0

    this._tryInitWorker()
  }

  // ── DataSource interface ────────────────────────────────────────────────────

  async getRows(params) {
    if (this._useWorker) {
      return this._send('getRows', params)
    }
    return this._adapter.getRows(params)
  }

  async getRowById(id) {
    if (this._useWorker) {
      const result = await this._send('getRowById', { id })
      return result
    }
    return this._adapter.getRowById(id)
  }

  getTotalCount() {
    if (this._useWorker) return this._totalCount
    return this._adapter.getTotalCount?.() ?? 0
  }

  async applyFilter(filterConfig) {
    // filterConfig is a plain object (not a function) for Worker compat
    if (this._useWorker) {
      const result = await this._send('applyFilter', { filter: filterConfig })
      this._totalCount = result.totalCount
      return
    }
    // Fallback: rebuild function on main thread
    this._adapter.applyFilter?.(filterConfig)
  }

  async clearFilter() {
    if (this._useWorker) {
      const result = await this._send('clearFilter', {})
      this._totalCount = result.totalCount
      return
    }
    this._adapter.applyFilter?.(null)
  }

  async applySort(sortConfig) {
    if (this._useWorker) {
      const result = await this._send('applySort', { sort: sortConfig })
      this._totalCount = result.totalCount
      return
    }
    // Fallback: use adapter's sort
    this._adapter.applySort?.()
  }

  subscribe(callback) {
    this._liveCallback = callback
    if (!this._useWorker) this._adapter.subscribe?.(callback)
  }

  unsubscribe() {
    this._liveCallback = null
    if (!this._useWorker) this._adapter.unsubscribe?.()
  }

  async pushLiveEvents(events) {
    const maxRows = this._options.maxTotalRows || 100000
    if (this._useWorker) {
      const result = await this._send('pushLiveEvents', { events, maxRows })
      this._totalCount = result.totalCount
      return
    }
    this._adapter.pushLiveEvents?.(events)
  }

  isServerSide() {
    return this._adapter.isServerSide?.() ?? false
  }

  destroy() {
    this._pending.forEach(({ reject }) => reject(new Error('WorkerBridge destroyed')))
    this._pending.clear()
    this._worker?.terminate()
    this._worker = null
  }

  isWorkerActive() {
    return this._useWorker
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _tryInitWorker() {
    if (typeof Worker === 'undefined') return

    try {
      this._worker = new Worker(
        new URL('./DataWorker.js', import.meta.url),
        { type: 'module' }
      )
      this._worker.onmessage  = this._handleMessage.bind(this)
      this._worker.onerror    = this._handleError.bind(this)

      // Send initial data to worker
      this._initWorkerData()
    } catch (e) {
      console.warn('[WorkerBridge] Worker init failed, falling back to main thread:', e.message)
      this._worker = null
    }
  }

  async _initWorkerData() {
    let data = []
    try {
      const result = await this._adapter.getRows({ start: 0, end: Infinity })
      data = Array.isArray(result) ? result : (result.rows || [])

      await this._send('init', {
        data,
        maxRows: this._options.maxTotalRows || 100000,
      })

      this._totalCount = data.length
      this._useWorker  = true
      this._ready      = true
    } catch (e) {
      console.warn('[EventLens] Worker data init failed, falling back to main thread:', e.message)
      this._worker?.terminate()
      this._worker     = null
      this._useWorker  = false
      this._totalCount = data.length  // fallback: count already fetched from adapter
      this._ready      = true
    }
  }

  _send(type, payload) {
    return new Promise((resolve, reject) => {
      if (!this._worker) {
        reject(new Error('Worker not available'))
        return
      }
      const id = ++this._msgId
      this._pending.set(id, { resolve, reject })
      this._worker.postMessage({ id, type, payload })
    })
  }

  _handleMessage(e) {
    const { id, type, success, result, error, events, totalCount } = e.data

    // Proactive live-push from Worker
    if (type === 'live-push') {
      this._totalCount = totalCount
      this._liveCallback?.(events)
      return
    }

    // Response to a sent message
    if (id !== undefined) {
      const pending = this._pending.get(id)
      if (!pending) return
      this._pending.delete(id)
      if (success) {
        pending.resolve(result)
      } else {
        pending.reject(new Error(error || 'Worker error'))
      }
    }
  }

  _handleError(e) {
    console.error('[WorkerBridge] Worker error:', e.message)
    this._pending.forEach(p => p.reject(new Error('Worker error: ' + e.message)))
    this._pending.clear()
    this._useWorker = false
  }
}
