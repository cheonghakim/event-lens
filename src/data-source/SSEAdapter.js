/**
 * SSEAdapter — Server-Sent Events 기반 실시간 이벤트 스트림.
 *
 * 사용 방법:
 *   const ds = new SSEAdapter({
 *     url:     'https://siem.example.com/stream/events',
 *     initial: async ({ start, end }) => fetchInitialRows(start, end),
 *   })
 *
 * SSE 이벤트 형식 (기본):
 *   event: security-event
 *   data: { "id": "...", "severity": "critical", ... }
 *
 *   또는 기본 data만 있는 형태:
 *   data: { "id": "...", "severity": "high", ... }
 */
export class SSEAdapter {
  constructor(options = {}) {
    this._url          = options.url
    this._initialFn    = options.initial     || null
    this._eventName    = options.eventName   || null  // null = default 'message' event
    this._withCredentials = options.withCredentials || false
    this._messageMapper  = options.messageMapper || this._defaultMessageMapper

    this._sse         = null
    this._subscriber  = null
    this._totalCount  = 0
    this._initialRows = []
    this._loaded      = false
    this._destroyed   = false
  }

  async getRows({ start, end }) {
    if (!this._loaded) await this._loadInitial()
    return {
      rows:       this._initialRows.slice(start, end + 1),
      totalCount: this._totalCount || this._initialRows.length,
    }
  }

  async getRowById(id) {
    await this._loadInitial()
    return this._initialRows.find(r => r.id === id) || null
  }

  getTotalCount() {
    return this._totalCount || this._initialRows.length
  }

  subscribe(callback) {
    this._subscriber = callback
    this._connect()
  }

  unsubscribe() {
    this._subscriber = null
    this._disconnect()
  }

  isServerSide() {
    return false
  }

  destroy() {
    this._destroyed = true
    this._disconnect()
    this._subscriber = null
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  async _loadInitial() {
    if (this._loaded) return
    if (this._initialFn) {
      try {
        const result = await this._initialFn({ start: 0, end: 999 })
        if (Array.isArray(result)) {
          this._initialRows = result
          this._totalCount  = result.length
        } else if (result?.rows) {
          this._initialRows = result.rows
          this._totalCount  = result.totalCount || result.rows.length
        }
      } catch (e) {
        console.error('[SSEAdapter] Initial load failed:', e)
      }
    }
    this._loaded = true
  }

  _connect() {
    if (this._destroyed) return
    if (this._sse) return  // already connected

    try {
      this._sse = new EventSource(this._url, { withCredentials: this._withCredentials })

      const handler = (e) => {
        try {
          const raw    = JSON.parse(e.data)
          const events = this._messageMapper(raw)
          if (events?.length) {
            this._initialRows.unshift(...events)
            this._subscriber?.(events)
          }
        } catch {
          // Ignore malformed messages
        }
      }

      if (this._eventName) {
        this._sse.addEventListener(this._eventName, handler)
      } else {
        this._sse.onmessage = handler
      }

      this._sse.onerror = () => {
        // EventSource auto-reconnects on error — no action needed
      }
    } catch (e) {
      console.error('[SSEAdapter] Connect failed:', e)
    }
  }

  _disconnect() {
    this._sse?.close()
    this._sse = null
  }

  _defaultMessageMapper(raw) {
    if (Array.isArray(raw)) return raw
    if (raw.id && raw.timestamp) return [raw]
    if (raw.event && raw.event.id) return [raw.event]
    return null
  }
}
