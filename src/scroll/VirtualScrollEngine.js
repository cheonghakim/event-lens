export const DENSITY_ROW_HEIGHTS = {
  compact:     24,
  normal:      32,
  comfortable: 40,
}

export class VirtualScrollEngine {
  constructor(options = {}) {
    this.rowHeight  = options.rowHeight || 32
    this.overscan   = options.overscan  || 5
    this.totalCount = 0

    this._containerHeight = 0
    this._scrollTop       = 0
    this._rafId           = null
    this._onScrollCb      = null
    this._scrollContainer = null
    this._spacerEl        = null
    this._resizeObserver  = null

    // Optional dynamic row height support
    this._positionIndex   = options.positionIndex || null  // PositionIndex instance
    this._heightCache     = options.heightCache   || null  // HeightCache instance
  }

  mount(scrollContainer, spacerEl) {
    this._scrollContainer = scrollContainer
    this._spacerEl        = spacerEl
    this._containerHeight = scrollContainer.clientHeight

    scrollContainer.addEventListener('scroll', this._handleScroll.bind(this), { passive: true })

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this._containerHeight = entry.contentRect.height
        this._flush()
      }
    })
    this._resizeObserver.observe(scrollContainer)
  }

  setTotalCount(count) {
    this.totalCount = count
    if (this._heightCache) this._heightCache.setCount(count)
    if (this._positionIndex) this._positionIndex.invalidate()
    this._updateSpacer()
  }

  setRowHeight(h) {
    this.rowHeight = h
    if (this._heightCache) this._heightCache.setDefault(h)
    if (this._positionIndex) this._positionIndex.invalidate()
    this._updateSpacer()
    this._flush()
  }

  /** Update a single row's height after it's been rendered and measured. */
  setMeasuredRowHeight(index, height) {
    if (!this._heightCache || !this._positionIndex) return
    this._heightCache.set(index, height)
    this._positionIndex.invalidate()
    this._updateSpacer()
  }

  onScroll(cb) {
    this._onScrollCb = cb
  }

  getVisibleRange() {
    if (this._positionIndex && this._heightCache) {
      return this._getVisibleRangeDynamic()
    }
    return this._getVisibleRangeFixed()
  }

  _getVisibleRangeFixed() {
    const scrollTop = this._scrollTop
    const startIdx = Math.max(
      0,
      Math.floor(scrollTop / this.rowHeight) - this.overscan
    )
    const endIdx = Math.min(
      this.totalCount - 1,
      Math.ceil((scrollTop + this._containerHeight) / this.rowHeight) + this.overscan
    )
    return {
      startIdx,
      endIdx,
      offsetTop: startIdx * this.rowHeight,
    }
  }

  _getVisibleRangeDynamic() {
    const pi      = this._positionIndex
    const scrollTop = this._scrollTop

    const startIdx = Math.max(0, pi.rowIndexAtOffset(scrollTop) - this.overscan)
    const endIdx   = Math.min(
      this.totalCount - 1,
      pi.rowIndexAtOffset(scrollTop + this._containerHeight) + this.overscan
    )

    return {
      startIdx,
      endIdx,
      offsetTop: pi.offsetForRow(startIdx),
    }
  }

  getTotalHeight() {
    if (this._positionIndex) return this._positionIndex.getTotalHeight()
    return this.totalCount * this.rowHeight
  }

  isAtEnd() {
    if (!this._scrollContainer) return true
    const { scrollTop, scrollHeight, clientHeight } = this._scrollContainer
    return scrollHeight - scrollTop - clientHeight < this.rowHeight * 3
  }

  isAtTop() {
    return !this._scrollContainer || this._scrollContainer.scrollTop < this.rowHeight
  }

  scrollToIndex(index) {
    if (!this._scrollContainer) return
    const clamped = Math.max(0, Math.min(index, this.totalCount - 1))
    this._scrollContainer.scrollTop = clamped * this.rowHeight
  }

  scrollToTop() {
    if (this._scrollContainer) this._scrollContainer.scrollTop = 0
  }

  scrollToBottom() {
    if (this._scrollContainer) {
      this._scrollContainer.scrollTop = this.getTotalHeight()
    }
  }

  _handleScroll() {
    this._scrollTop = this._scrollContainer.scrollTop
    if (this._rafId) return
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null
      this._flush()
    })
  }

  _flush() {
    this._onScrollCb?.(this.getVisibleRange())
  }

  _updateSpacer() {
    if (this._spacerEl) {
      this._spacerEl.style.height = `${this.getTotalHeight()}px`
    }
  }

  destroy() {
    this._resizeObserver?.disconnect()
    if (this._rafId) cancelAnimationFrame(this._rafId)
    if (this._scrollContainer) {
      this._scrollContainer.removeEventListener('scroll', this._handleScroll)
    }
  }
}
