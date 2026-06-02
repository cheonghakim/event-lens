/**
 * StateManager — 컬럼 순서/가시성/너비, 활성 필터를 localStorage에 저장/복원.
 *
 * storageKey 옵션으로 여러 뷰어 인스턴스를 구분합니다.
 * 모든 작업은 try/catch — localStorage가 없거나 쿼터 초과여도 무음 실패.
 */
export class StateManager {
  constructor(options = {}) {
    this._key     = options.storageKey || 'trace-scope-state'
    this._version = 1
  }

  // ── Column state ─────────────────────────────────────────────────────────────

  saveColumns(columnManager) {
    this._set('columns', {
      order:   columnManager._order,
      visible: [...columnManager._visible],
      widths:  Object.fromEntries(
        columnManager._all.map(c => [c.id, c.width])
      ),
    })
  }

  restoreColumns(columnManager) {
    const saved = this._get('columns')
    if (!saved) return false

    try {
      // Restore order (only ids that still exist)
      const validIds = new Set(columnManager._all.map(c => c.id))
      const order = saved.order?.filter(id => validIds.has(id)) || []
      // Append any new columns not in saved order
      for (const c of columnManager._all) {
        if (!order.includes(c.id)) order.push(c.id)
      }
      columnManager._order = order

      // Restore visibility
      if (Array.isArray(saved.visible)) {
        columnManager._visible = new Set(saved.visible.filter(id => validIds.has(id)))
      }

      // Restore widths
      if (saved.widths) {
        for (const col of columnManager._all) {
          if (saved.widths[col.id] != null) col.width = saved.widths[col.id]
        }
      }

      return true
    } catch {
      return false
    }
  }

  // ── Filter state ─────────────────────────────────────────────────────────────

  saveFilter(filter) {
    // Don't persist empty filter
    if (!filter || Object.keys(filter).length === 0) {
      this._remove('filter')
    } else {
      this._set('filter', filter)
    }
  }

  restoreFilter() {
    return this._get('filter') || null
  }

  clearFilter() {
    this._remove('filter')
  }

  // ── Misc ─────────────────────────────────────────────────────────────────────

  saveDensity(density) {
    this._set('density', density)
  }

  restoreDensity() {
    return this._get('density') || null
  }

  saveTheme(theme) {
    this._set('theme', theme)
  }

  restoreTheme() {
    return this._get('theme') || null
  }

  clear() {
    try { localStorage.removeItem(this._key) } catch {}
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _get(section) {
    try {
      const raw = localStorage.getItem(this._key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (parsed._v !== this._version) return null
      return parsed[section] ?? null
    } catch {
      return null
    }
  }

  _set(section, value) {
    try {
      const raw = localStorage.getItem(this._key)
      const obj = raw ? JSON.parse(raw) : {}
      obj._v = this._version
      obj[section] = value
      localStorage.setItem(this._key, JSON.stringify(obj))
    } catch {}
  }

  _remove(section) {
    try {
      const raw = localStorage.getItem(this._key)
      if (!raw) return
      const obj = JSON.parse(raw)
      delete obj[section]
      localStorage.setItem(this._key, JSON.stringify(obj))
    } catch {}
  }
}
