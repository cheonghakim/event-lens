import { buildFilterFn } from './filterUtils.js'

export class FilterEngine {
  constructor(dataSource) {
    this._dataSource    = dataSource
    this._currentFilter = {}
  }

  apply(filter) {
    this._currentFilter = filter || {}

    if (!this._dataSource.applyFilter) return

    // WorkerBridge.applyFilter accepts a plain config object (not a function).
    // StaticArrayAdapter.applyFilter accepts a predicate function.
    // We detect which interface to use:
    if (this._dataSource.isWorkerActive?.()) {
      // Worker mode: pass config object, Worker builds its own predicate
      this._dataSource.applyFilter(filter || null)
    } else {
      // Main thread mode: pass predicate function
      const fn = buildFilterFn(filter)
      this._dataSource.applyFilter(fn)
    }
  }

  getFilter() {
    return { ...this._currentFilter }
  }

  clear() {
    this._currentFilter = {}
    if (!this._dataSource.applyFilter) return

    if (this._dataSource.isWorkerActive?.()) {
      this._dataSource.clearFilter?.() || this._dataSource.applyFilter(null)
    } else {
      this._dataSource.applyFilter(null)
    }
  }

  // Exposed for LiveController to filter live events on main thread
  buildFilterFn(filter) {
    return buildFilterFn(filter)
  }
}
