/**
 * WebSocketAdapter — WebSocket 기반 실시간 이벤트 스트림.
 *
 * 사용 방법:
 *   const ds = new WebSocketAdapter({
 *     url:       'wss://siem.example.com/stream',
 *     initial:   async ({ start, end }) => fetchInitialRows(start, end),  // 선택
 *     reconnect: true,
 *   })
 *
 * WebSocket 메시지 형식 (기본):
 *   { type: 'event',  data: SecurityEvent }
 *   { type: 'events', data: SecurityEvent[] }
 *   { type: 'total',  count: 50000 }
 *   또는 그냥 SecurityEvent JSON (감지 자동)
 */
export class WebSocketAdapter {
  constructor(options = {}) {
    this._url          = options.url
    this._initialFn    = options.initial    || null
    this._reconnect    = options.reconnect  !== false
    this._reconnectMs  = options.reconnectMs || 3000
    this._messageMapper = options.messageMapper || this._defaultMessageMapper

    this._ws           = null
    this._subscriber   = null
    this._totalCount   = 0
    this._initialRows  = []
    this._loaded       = false
    this._reconnTimer  = null
    this._destroyed    = false
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
    return false  // initial data is client-cached
  }

  getConnectionState() {
    if (!this._ws) return 'disconnected'
    const states = ['connecting', 'connected', 'closing', 'disconnected']
    return states[this._ws.readyState] || 'unknown'
  }

  destroy() {
    this._destroyed = true
    clearTimeout(this._reconnTimer)
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
        console.error('[WebSocketAdapter] Initial load failed:', e)
      }
    }
    this._loaded = true
  }

  _connect() {
    if (this._destroyed) return
    if (this._ws && this._ws.readyState <= 1) return  // already connecting/open

    try {
      this._ws = new WebSocket(this._url)

      this._ws.onopen = () => {
        clearTimeout(this._reconnTimer)
      }

      this._ws.onmessage = (e) => {
        try {
          const raw = JSON.parse(e.data)
          const events = this._messageMapper(raw)
          if (events?.length) {
            this._initialRows.unshift(...events)
            this._subscriber?.(events)
          }
        } catch {
          // Ignore unparseable messages
        }
      }

      this._ws.onclose = (e) => {
        if (!this._destroyed && this._reconnect && this._subscriber) {
          this._reconnTimer = setTimeout(() => this._connect(), this._reconnectMs)
        }
      }

      this._ws.onerror = (e) => {
        console.error('[WebSocketAdapter] WS error')
      }
    } catch (e) {
      console.error('[WebSocketAdapter] Connect failed:', e)
    }
  }

  _disconnect() {
    clearTimeout(this._reconnTimer)
    if (this._ws) {
      this._ws.onclose = null  // prevent reconnect
      this._ws.close()
      this._ws = null
    }
  }

  _defaultMessageMapper(raw) {
    // Handle common message formats
    if (Array.isArray(raw)) return raw
    if (raw.type === 'events' && Array.isArray(raw.data)) return raw.data
    if (raw.type === 'event'  && raw.data)                return [raw.data]
    if (raw.id && raw.timestamp)                          return [raw]  // direct event object
    return null
  }
}
