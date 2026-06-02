export class AsyncFunctionAdapter {
  constructor(fn) {
    this._fn = fn
    this._cache = []
    this._totalCount = 0
    this._loaded = false
    this._subscriber = null
    this._loading = false
  }

  async _ensureLoaded() {
    if (this._loaded || this._loading) return
    this._loading = true
    try {
      const result = await this._fn({ start: 0, end: Infinity })
      if (Array.isArray(result)) {
        this._cache = result
        this._totalCount = result.length
      } else if (result && Array.isArray(result.rows)) {
        this._cache = result.rows
        this._totalCount = result.totalCount ?? result.rows.length
      }
      this._loaded = true
    } finally {
      this._loading = false
    }
  }

  async getRows({ start, end }) {
    await this._ensureLoaded()
    return {
      rows:       this._cache.slice(start, end + 1),
      totalCount: this._totalCount,
    }
  }

  async getRowById(id) {
    await this._ensureLoaded()
    return this._cache.find(r => r.id === id) || null
  }

  getTotalCount() {
    return this._totalCount
  }

  applyFilter(filterFn) {
    // Re-load is triggered externally; this adapter caches full data
    // Filtering is done by slicing _cache after the caller applies the filter
    this._filterFn = filterFn
  }

  subscribe(callback) {
    this._subscriber = callback
  }

  unsubscribe() {
    this._subscriber = null
  }

  isServerSide() {
    return false
  }

  async refresh() {
    this._loaded = false
    this._cache  = []
    this._totalCount = 0
    await this._ensureLoaded()
  }
}
