/**
 * HeightCache — per-row height storage for dynamic row heights.
 *
 * When row heights are uniform, use VirtualScrollEngine directly (faster).
 * HeightCache is used by DynamicVirtualScrollEngine when rows can expand
 * (e.g. multi-line detail cells or card view).
 */
export class HeightCache {
  constructor(defaultHeight = 32) {
    this._default = defaultHeight
    this._heights = new Map()    // index → height
    this._total   = 0
    this._count   = 0
    this._dirty   = true         // position index needs rebuild
  }

  setDefault(h) {
    this._default = h
    this.clear()
  }

  set(index, height) {
    const prev = this._heights.get(index) ?? this._default
    if (prev !== height) {
      this._heights.set(index, height)
      this._dirty = true
    }
  }

  get(index) {
    return this._heights.get(index) ?? this._default
  }

  setCount(count) {
    this._count = count
    this._dirty = true
  }

  getTotalHeight() {
    let total = 0
    for (let i = 0; i < this._count; i++) {
      total += this.get(i)
    }
    return total
  }

  clear() {
    this._heights.clear()
    this._dirty = true
  }
}
