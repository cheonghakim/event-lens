/**
 * DataWorker — runs inside a Web Worker.
 * Handles data management off the main thread:
 *   - Filter / sort (no main thread blocking)
 *   - Sliding window prefetch
 *   - Live event buffering
 *
 * Protocol:
 *   Main → Worker: { id, type, payload }
 *   Worker → Main: { id, success, result }  (response)
 *                  { type: 'live-push', events }  (proactive push)
 */
import { buildFilterFn, buildSortCompareFn } from '../filter/filterUtils.js'

// ── Worker state ──────────────────────────────────────────────────────────────
let _original  = []   // immutable source
let _filtered  = []   // after filter applied
let _sortFn    = null
let _filterCfg = null

// Window manager: tracks which range is "hot" (in memory window)
const WINDOW_EXTRA = 500   // rows to keep above/below viewport

// ── Message dispatch ──────────────────────────────────────────────────────────
self.onmessage = async (e) => {
  const { id, type, payload } = e.data

  try {
    const result = await dispatch(type, payload)
    self.postMessage({ id, success: true, result })
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message })
  }
}

async function dispatch(type, payload) {
  switch (type) {
    case 'init':
      return handleInit(payload)

    case 'getRows':
      return handleGetRows(payload)

    case 'getRowById':
      return handleGetRowById(payload)

    case 'getTotalCount':
      return { totalCount: _filtered.length }

    case 'applyFilter':
      return handleApplyFilter(payload)

    case 'clearFilter':
      return handleClearFilter()

    case 'applySort':
      return handleApplySort(payload)

    case 'pushLiveEvents':
      return handlePushLiveEvents(payload)

    case 'ping':
      return { pong: true }

    default:
      throw new Error(`[DataWorker] Unknown message type: ${type}`)
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleInit({ data, maxRows }) {
  _original = Array.isArray(data) ? data : []
  _filtered = [..._original]
  if (maxRows) {
    _original = _original.slice(0, maxRows)
    _filtered = _filtered.slice(0, maxRows)
  }
  return { totalCount: _filtered.length }
}

function handleGetRows({ start, end }) {
  const rows = _filtered.slice(start, end + 1)
  return { rows, totalCount: _filtered.length }
}

function handleGetRowById({ id }) {
  return _original.find(r => r.id === id) || null
}

function handleApplyFilter({ filter }) {
  _filterCfg = filter
  const fn = buildFilterFn(filter)
  _filtered = fn ? _original.filter(fn) : [..._original]
  if (_sortFn) _filtered.sort(_sortFn)
  return { totalCount: _filtered.length }
}

function handleClearFilter() {
  _filterCfg = null
  _filtered  = [..._original]
  if (_sortFn) _filtered.sort(_sortFn)
  return { totalCount: _filtered.length }
}

function handleApplySort({ sort }) {
  _sortFn = buildSortCompareFn(sort)
  if (_sortFn) _filtered.sort(_sortFn)
  return { totalCount: _filtered.length }
}

function handlePushLiveEvents({ events, maxRows }) {
  if (!Array.isArray(events) || events.length === 0) {
    return { totalCount: _filtered.length }
  }

  // Prepend to original
  _original.unshift(...events)

  // Evict oldest if over limit
  if (maxRows && _original.length > maxRows) {
    _original.splice(maxRows)
  }

  // Rebuild filtered
  const fn = _filterCfg ? buildFilterFn(_filterCfg) : null
  _filtered = fn ? _original.filter(fn) : [..._original]
  if (_sortFn) _filtered.sort(_sortFn)

  // Proactively push live events back so main thread can update badge
  self.postMessage({ type: 'live-push', events, totalCount: _filtered.length })

  return { totalCount: _filtered.length }
}
