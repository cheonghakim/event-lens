export class StaticArrayAdapter {
  constructor(data) {
    this._original = Array.isArray(data) ? [...data] : []
    this._filtered  = [...this._original]
    this._subscriber = null
  }

  async getRows({ start, end }) {
    return {
      rows:       this._filtered.slice(start, end + 1),
      totalCount: this._filtered.length,
    }
  }

  async getRowById(id) {
    return this._original.find(r => r.id === id) || null
  }

  getTotalCount() {
    return this._filtered.length
  }

  applyFilter(filterFn) {
    this._filterFn = filterFn || null   // store for pushLiveEvents re-application
    this._filtered = filterFn
      ? this._original.filter(filterFn)
      : [...this._original]
  }

  applySort(compareFn) {
    if (compareFn) this._filtered.sort(compareFn)
  }

  subscribe(callback) {
    this._subscriber = callback
  }

  unsubscribe() {
    this._subscriber = null
  }

  pushLiveEvents(events) {
    // All events go to _original for persistence
    this._original.unshift(...events)

    // Only filter-matching events go to _filtered
    const matching = this._filterFn ? events.filter(this._filterFn) : events
    if (matching.length > 0) this._filtered.unshift(...matching)

    // Evict oldest rows when over limit
    if (this._maxRows && this._original.length > this._maxRows) {
      const excess = this._original.length - this._maxRows
      this._original.splice(this._original.length - excess, excess)
    }
    if (this._maxRows && this._filtered.length > this._maxRows) {
      const excess = this._filtered.length - this._maxRows
      this._filtered.splice(this._filtered.length - excess, excess)
    }

    this._subscriber?.(matching.length > 0 ? matching : [])
  }

  setMaxRows(n) {
    this._maxRows = n
  }

  isServerSide() {
    return false
  }
}
