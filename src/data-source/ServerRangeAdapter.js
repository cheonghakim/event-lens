/**
 * ServerRangeAdapter — offset/cursor 기반 REST API 연동.
 *
 * 서버 API 규격 (기본):
 *   GET /api/events?offset=0&limit=200&sort_field=timestamp&sort_dir=desc&...
 *   Response: { rows: [...], total: 50000 }
 *
 * 커스텀 응답 파싱은 responseMapper 옵션으로 처리.
 */
export class ServerRangeAdapter {
  constructor(options = {}) {
    // options.url          — API endpoint
    // options.pageSize     — rows per request (default 200)
    // options.headers      — extra HTTP headers (e.g. auth token)
    // options.responseMapper(raw) → { rows, totalCount }
    // options.paramsMapper(params) → URLSearchParams
    // options.credentials  — 'include' | 'same-origin' | 'omit'

    this._url           = options.url
    this._pageSize      = options.pageSize || 200
    this._headers       = options.headers  || {}
    this._credentials   = options.credentials || 'same-origin'
    this._responseMapper = options.responseMapper || this._defaultResponseMapper
    this._paramsMapper   = options.paramsMapper   || this._defaultParamsMapper
    this._totalCount    = 0
    this._subscriber    = null
    this._currentSort   = null
    this._currentFilter = null
    this._abortCtrl     = null
  }

  async getRows({ start, end, sort, filter, signal }) {
    // Merge with current sort/filter if not explicitly passed
    const effectiveSort   = sort   || this._currentSort
    const effectiveFilter = filter || this._currentFilter

    const params = this._paramsMapper({
      offset: start,
      limit:  Math.min(end - start + 1, this._pageSize),
      sort:   effectiveSort,
      filter: effectiveFilter,
    })

    const url = `${this._url}?${params.toString()}`

    // Cancel previous in-flight request
    if (this._abortCtrl) this._abortCtrl.abort()
    this._abortCtrl = new AbortController()
    const fetchSignal = signal
      ? this._combineSignals(signal, this._abortCtrl.signal)
      : this._abortCtrl.signal

    try {
      const res = await fetch(url, {
        headers:     this._headers,
        credentials: this._credentials,
        signal:      fetchSignal,
      })

      if (!res.ok) throw new Error(`[ServerRangeAdapter] HTTP ${res.status}: ${url}`)

      const raw = await res.json()
      const { rows, totalCount } = this._responseMapper(raw)

      if (totalCount != null) this._totalCount = totalCount
      return { rows: rows || [], totalCount: this._totalCount }
    } catch (e) {
      if (e.name === 'AbortError') return { rows: [], totalCount: this._totalCount }
      throw e
    }
  }

  async getRowById(id) {
    try {
      const res = await fetch(`${this._url}/${encodeURIComponent(id)}`, {
        headers:     this._headers,
        credentials: this._credentials,
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  getTotalCount() {
    return this._totalCount
  }

  // For server-side, filter/sort are passed as query params to getRows.
  // Store them so subsequent getRows calls include them automatically.
  applyFilter(filterConfig) {
    this._currentFilter = filterConfig
  }

  applySort(sortConfig) {
    this._currentSort = sortConfig
  }

  subscribe(callback) {
    this._subscriber = callback
  }

  unsubscribe() {
    this._subscriber = null
  }

  isServerSide() {
    return true
  }

  destroy() {
    this._abortCtrl?.abort()
    this._subscriber = null
  }

  // ── Default mappers ─────────────────────────────────────────────────────────

  _defaultResponseMapper(raw) {
    // Handles common API shapes:
    // { rows: [...], total: N }
    // { data: [...], total: N }
    // { events: [...], totalCount: N }
    // [...] (array only, no total)
    if (Array.isArray(raw)) {
      return { rows: raw, totalCount: raw.length }
    }
    return {
      rows:       raw.rows || raw.data || raw.events || raw.items || [],
      totalCount: raw.total || raw.totalCount || raw.count || raw.total_count || 0,
    }
  }

  _defaultParamsMapper({ offset, limit, sort, filter }) {
    const params = new URLSearchParams()
    params.set('offset', String(offset))
    params.set('limit',  String(limit))

    if (sort) {
      params.set('sort_field', sort.field)
      params.set('sort_dir',   sort.direction)
    }

    if (filter) {
      if (filter.severity?.length)  params.set('severity',  filter.severity.join(','))
      if (filter.quickSearch)        params.set('q',         filter.quickSearch)
      if (filter.timeRange?.from)    params.set('from',      filter.timeRange.from)
      if (filter.timeRange?.to)      params.set('to',        filter.timeRange.to)
      if (filter.srcIp?.length)      params.set('src_ip',    filter.srcIp.join(','))
      if (filter.dstIp?.length)      params.set('dst_ip',    filter.dstIp.join(','))
      if (filter.user?.length)       params.set('user',      filter.user.join(','))
      if (filter.asset?.length)      params.set('asset',     filter.asset.join(','))
      if (filter.ruleId?.length)     params.set('rule_id',   filter.ruleId.join(','))
      if (filter.eventType?.length)  params.set('event_type',filter.eventType.join(','))
      if (filter.rawLogContains)     params.set('raw_log',   filter.rawLogContains)
    }

    return params
  }

  _combineSignals(s1, s2) {
    const ctrl = new AbortController()
    const abort = () => ctrl.abort()
    s1.addEventListener('abort', abort, { once: true })
    s2.addEventListener('abort', abort, { once: true })
    return ctrl.signal
  }
}
