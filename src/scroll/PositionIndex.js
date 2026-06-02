/**
 * PositionIndex — binary search over cumulative row positions.
 *
 * Given a HeightCache, builds a cumulative offset array and answers:
 *   rowIndexAtOffset(scrollTop) → rowIndex
 *   offsetForRow(index)         → px from top
 *
 * Rebuilds only when HeightCache is dirty (heights changed or row count changed).
 */
export class PositionIndex {
  constructor(heightCache) {
    this._cache     = heightCache
    this._offsets   = []   // offsets[i] = px top of row i
    this._total     = 0
    this._built     = false
  }

  // Build cumulative positions array
  build() {
    const n = this._cache._count
    const offsets = new Float64Array(n + 1)
    let pos = 0
    for (let i = 0; i < n; i++) {
      offsets[i] = pos
      pos += this._cache.get(i)
    }
    offsets[n] = pos
    this._offsets = offsets
    this._total   = pos
    this._built   = true
    this._cache._dirty = false
  }

  _ensureBuilt() {
    if (!this._built || this._cache._dirty) this.build()
  }

  getTotalHeight() {
    this._ensureBuilt()
    return this._total
  }

  /** Returns the row index whose range contains the given scrollTop offset. */
  rowIndexAtOffset(scrollTop) {
    this._ensureBuilt()
    const n = this._offsets.length - 1
    if (n <= 0) return 0
    if (scrollTop <= 0) return 0
    if (scrollTop >= this._total) return n - 1

    // Binary search
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >>> 1
      if (this._offsets[mid] <= scrollTop) lo = mid
      else hi = mid - 1
    }
    return lo
  }

  /** Returns the pixel offset from the top for a given row index. */
  offsetForRow(index) {
    this._ensureBuilt()
    const clamped = Math.max(0, Math.min(index, this._offsets.length - 1))
    return this._offsets[clamped]
  }

  invalidate() {
    this._built = false
    this._cache._dirty = true
  }
}
