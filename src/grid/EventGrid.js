import { el, on }                                  from '../utils/dom.js'
import { VirtualScrollEngine, DENSITY_ROW_HEIGHTS } from '../scroll/VirtualScrollEngine.js'
import { RowPool }             from './RowPool.js'
import { ColumnManager }       from './ColumnManager.js'
import { HeaderRenderer }      from './HeaderRenderer.js'
import { RowRenderer }         from './RowRenderer.js'
import { SelectionManager }    from './SelectionManager.js'
import { NewEventBadge }       from './NewEventBadge.js'
import { GroupingEngine }      from './GroupingEngine.js'
import { buildSortCompareFn }  from '../filter/filterUtils.js'
import { DomRenderBackend }    from '../render/DomRenderBackend.js'
import { CanvasRenderBackend } from '../render/CanvasRenderBackend.js'
import { HeightCache }         from '../scroll/HeightCache.js'
import { PositionIndex }       from '../scroll/PositionIndex.js'

export class EventGrid {
  constructor(core) {
    this._core       = core
    this._opts       = core._options
    this._bus        = core._bus
    this._dataSource = core._dataSource
    this._pluginCtx  = core._plugins?.ctx || null

    this._rows        = []
    this._activeNodes = []

    this._cm           = new ColumnManager(this._opts.columns)
    this._highlight    = core._highlight
    this._rowRenderer  = new RowRenderer(this._cm, this._highlight, this._pluginCtx)
    this._selection    = new SelectionManager(this._bus)

    // Resolve initial rowHeight from density option
    const initDensity = this._opts.density || 'normal'
    const initRowH    = DENSITY_ROW_HEIGHTS[initDensity] ?? DENSITY_ROW_HEIGHTS.normal
    const vsOpts      = { ...this._opts.virtualScroll, rowHeight: this._opts.virtualScroll?.rowHeight ?? initRowH }

    // Dynamic row height support
    if (vsOpts.dynamicHeight) {
      this._heightCache  = new HeightCache(vsOpts.rowHeight)
      this._posIndex     = new PositionIndex(this._heightCache)
      vsOpts.heightCache    = this._heightCache
      vsOpts.positionIndex  = this._posIndex
    }

    this._vsEngine = new VirtualScrollEngine(vsOpts)

    // Render backend: 'canvas' or 'dom' (default)
    this._renderMode   = this._opts.renderMode || 'dom'
    this._backend      = null  // created in mount()

    this._el        = null
    this._headerWrap= null
    this._scrollBody= null
    this._spacer    = null
    this._rowsWrap  = null
    this._badge     = null
    this._cleanups  = []

    this._currentRange = { startIdx: 0, endIdx: 0 }

    // Grouping
    this._groupEngine = this._opts.groupBy
      ? new GroupingEngine({ field: this._opts.groupBy })
      : null
    this._groupedFlat = []  // flat grouped list when grouping is active
  }

  mount(container) {
    this._el = el('div', 'el-grid', { role: 'grid', 'aria-label': '보안 이벤트' })

    // ── Header wrapper (clipped, header translates on h-scroll)
    this._headerWrap = el('div', 'el-grid-header-wrap')
    this._header     = new HeaderRenderer(this._cm)
    const headerEl   = this._header.render(
      (sort) => this._bus.emit('sort:changed', sort),
      ()     => this._rebuildAfterColumnChange(),
      this._headerWrap
    )
    this._headerWrap.appendChild(headerEl)
    this._el.appendChild(this._headerWrap)
    this._updateHeaderMinWidth()

    // ── Scroll body (virtual scroll + horizontal)
    this._scrollBody = el('div', 'el-grid-body', {
      role:     'rowgroup',
      tabindex: '0',
      'aria-label': '이벤트 목록',
    })

    this._spacer   = el('div', 'el-grid-spacer')
    this._scrollBody.appendChild(this._spacer)
    this._el.appendChild(this._scrollBody)

    // ── Render backend ─────────────────────────────────────────────────────────
    if (this._renderMode === 'canvas') {
      this._backend = new CanvasRenderBackend(this._cm, this._highlight, {
        rowHeight: this._vsEngine.rowHeight,
      })
      this._backend.mount(this._spacer)
      // Canvas: hit-test on click, no direct DOM row nodes
      this._rowsWrap   = null
      this._activeNodes = []
    } else {
      this._backend  = new DomRenderBackend(this._rowRenderer, this._selection)
      this._backend.mount(this._spacer)
      this._rowsWrap = this._backend.rowsWrap
      this._activeNodes = this._backend.activeNodes
    }

    // ── New event badge
    this._badge = new NewEventBadge(this._el, () => this._vsEngine.scrollToTop())

    // ── Row pool (DOM mode only — backend manages internally)
    this._rowPool = null  // backend handles pooling now

    container.appendChild(this._el)

    // ── Column resize
    this._cm.mountResizeHandles(headerEl, (col) => {
      this._header.updateColumnWidth(col)
      this._activeNodes.forEach(n => this._rowRenderer.updateColumnWidths(n))
      this._updateHeaderMinWidth()
      this._updateSpacerMinWidth()
    })

    // ── Column change (visibility/reorder) handler
    this._cm.onChange(() => this._rebuildAfterColumnChange())

    // ── Virtual scroll
    this._vsEngine.mount(this._scrollBody, this._spacer)
    this._vsEngine.onScroll((range) => this._onScrollRange(range))

    // ── Horizontal scroll sync: body → header
    this._cleanups.push(on(this._scrollBody, 'scroll', () => {
      headerEl.style.transform = `translateX(-${this._scrollBody.scrollLeft}px)`
    }))

    // ── Row interactions (DOM mode: event delegation; Canvas mode: hit-test)
    if (this._renderMode === 'canvas') {
      this._cleanups.push(on(this._spacer, 'click', (e) => {
        const eventId = this._backend.hitTest(e.clientX, e.clientY)
        if (eventId) this._onRowClickById(eventId)
      }))
    } else {
      const domWrap = this._rowsWrap || this._spacer
      this._cleanups.push(on(domWrap, 'click', (e) => {
        const rowEl = e.target.closest('.el-row')
        if (rowEl) this._onRowClick(rowEl)
      }))
      this._cleanups.push(on(domWrap, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          const rowEl = e.target.closest('.el-row')
          if (rowEl) this._onRowClick(rowEl)
        }
      }))
    }

    this._cleanups.push(on(this._scrollBody, 'keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); this._moveSelection(1)  }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._moveSelection(-1) }
      if (e.key === 'Escape')    { this._selection.deselect() }
    }))

    // ── Bus
    const onSort   = this._onSortChanged.bind(this)
    const onFilter = this._onFilterChanged.bind(this)
    const onLive   = this._onLiveNewEvents.bind(this)
    this._bus.on('sort:changed',    onSort)
    this._bus.on('filter:changed',  onFilter)
    this._bus.on('live:new-events', onLive)
    this._cleanups.push(() => {
      this._bus.off('sort:changed',    onSort)
      this._bus.off('filter:changed',  onFilter)
      this._bus.off('live:new-events', onLive)
    })

    // ── Density observer: update rowHeight when data-el-density changes
    const rootEl = this._core._rootEl
    if (rootEl && typeof MutationObserver !== 'undefined') {
      this._densityObserver = new MutationObserver(() => {
        const density = rootEl.dataset.elDensity || 'normal'
        const h = DENSITY_ROW_HEIGHTS[density] ?? DENSITY_ROW_HEIGHTS.normal
        if (h !== this._vsEngine.rowHeight) {
          this._vsEngine.setRowHeight(h)
          this._vsEngine.scrollToTop()
          this.refresh()
        }
      })
      this._densityObserver.observe(rootEl, { attributes: true, attributeFilter: ['data-el-density'] })
      this._cleanups.push(() => this._densityObserver.disconnect())
    }
  }

  async load() {
    const total = await this._resolveTotal()
    this._vsEngine.setTotalCount(total)
    this._updateSpacerMinWidth()
    await this._fetchAndRender(this._vsEngine.getVisibleRange())
  }

  async refresh() {
    const total = await this._resolveTotal()
    this._vsEngine.setTotalCount(total)
    await this._fetchAndRender(this._vsEngine.getVisibleRange())
  }

  // When grouping is active, total = flat grouped array length (includes group headers)
  async _resolveTotal() {
    if (!this._groupEngine) return this._dataSource.getTotalCount?.() ?? 0

    // Need to fetch all data to build groups
    const dataTotal = this._dataSource.getTotalCount?.() ?? 0
    if (dataTotal === 0) return 0
    const { rows } = await this._dataSource.getRows({ start: 0, end: dataTotal - 1 })
    this._groupedFlat = this._groupEngine.build(rows || [])
    return this._groupedFlat.length
  }

  scrollToIndex(index) { this._vsEngine.scrollToIndex(index) }
  scrollToTop()        { this._vsEngine.scrollToTop()    }
  scrollToBottom()     { this._vsEngine.scrollToBottom() }

  selectEventById(id) {
    const node = this._activeNodes.find(n => n.dataset.eventId === id)
    this._selection.select(id, node || null)
  }

  getSelectedId() { return this._selection.getSelectedId() }

  prependRows(newEvents) {
    const liveOpts = this._opts.live
    const newTotal = this._vsEngine.totalCount + newEvents.length
    this._vsEngine.setTotalCount(newTotal)

    if (this._vsEngine.isAtEnd() && liveOpts.autoScroll === 'when-at-end') {
      this._vsEngine.scrollToTop()
      this._fetchAndRender(this._vsEngine.getVisibleRange())
    } else if (this._vsEngine.isAtTop()) {
      this._fetchAndRender(this._vsEngine.getVisibleRange())
    } else {
      if (liveOpts.showNewEventBadge && liveOpts.pauseOnUserScroll) {
        this._badge.add(newEvents.length)
      }
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _rebuildAfterColumnChange() {
    this._rowRenderer = new RowRenderer(this._cm, this._highlight, this._pluginCtx)
    this._header.updateAll((sort) => this._bus.emit('sort:changed', sort))
    this._updateHeaderMinWidth()
    this._updateSpacerMinWidth()

    // Re-attach resize + drag handlers
    const headerEl = this._header._el
    this._cm.mountResizeHandles(headerEl, (col) => {
      this._header.updateColumnWidth(col)
      this._activeNodes.forEach(n => this._rowRenderer.updateColumnWidths(n))
      this._updateHeaderMinWidth()
      this._updateSpacerMinWidth()
    })

    // Re-wire h-scroll sync for new header element
    // (old listener still works since it references headerEl.style.transform)

    this._fetchAndRender(this._vsEngine.getVisibleRange())
  }

  _updateHeaderMinWidth() {
    const total = this._cm.getTotalWidth() + 50  // +50 for picker cell
    if (this._header._el) this._header._el.style.minWidth = `${total}px`
  }

  _updateSpacerMinWidth() {
    const total = this._cm.getTotalWidth()
    if (this._spacer)   this._spacer.style.minWidth   = `${total}px`
    if (this._rowsWrap) this._rowsWrap.style.minWidth = `${total}px`
  }

  async _onScrollRange(range) {
    this._currentRange = range
    await this._fetchAndRender(range)
  }

  async _fetchAndRender({ startIdx, endIdx, offsetTop }) {
    if (endIdx < startIdx || this._vsEngine.totalCount === 0) {
      this._clearRows()
      return
    }

    try {
      if (this._groupEngine) {
        // Grouping: _groupedFlat already built by _resolveTotal / refresh
        // Slice the flat list by virtual scroll indices
        const slice = this._groupedFlat.slice(startIdx, endIdx + 1)
        const off   = offsetTop ?? startIdx * this._vsEngine.rowHeight
        this._renderGroupedRows(slice, off)
        return
      }

      const { rows, totalCount } = await this._dataSource.getRows({ start: startIdx, end: endIdx })

      if (totalCount !== undefined && totalCount !== this._vsEngine.totalCount) {
        this._vsEngine.setTotalCount(totalCount)
      }

      this._rows = rows || []
      this._renderRows(this._rows, startIdx, offsetTop ?? startIdx * this._vsEngine.rowHeight)
    } catch (e) {
      console.error('[EventLens] Error fetching rows:', e)
      this._bus.emit('data:error', { error: e })
    }
  }

  _renderRows(rows, startIdx, offsetTop) {
    // Delegate to backend (DOM or Canvas)
    this._backend.renderRows(rows, startIdx, offsetTop ?? startIdx * this._vsEngine.rowHeight)

    // Keep activeNodes in sync for DOM mode (used by selection / resize)
    if (this._renderMode !== 'canvas') {
      this._activeNodes = this._backend.activeNodes

      // If dynamic height is enabled, measure rows and update HeightCache
      if (this._heightCache) {
        requestAnimationFrame(() => {
          this._activeNodes.forEach((rowEl, i) => {
            const h = rowEl.offsetHeight
            if (h > 0) this._vsEngine.setMeasuredRowHeight(startIdx + i, h)
          })
        })
      }
    }
  }

  _renderGroupedRows(flatGrouped, offsetTop) {
    if (this._renderMode === 'canvas') {
      // Canvas: render only event rows from grouped list
      const eventRows = flatGrouped.filter(i => i.type === 'row').map(i => i.event)
      this._backend.renderRows(eventRows, 0, offsetTop)
      return
    }

    // DOM mode: render groups with headers
    this._backend.clear()
    this._activeNodes = []

    const wrap = this._rowsWrap || this._backend.rowsWrap
    if (!wrap) return
    wrap.style.transform = `translateY(${offsetTop}px)`

    const frag  = document.createDocumentFragment()
    let rowIdx  = 0

    for (const item of flatGrouped) {
      if (item.type === 'group') {
        const groupEl = this._renderGroupHeader(item)
        frag.appendChild(groupEl)
        this._activeNodes.push(groupEl)
      } else {
        const rowEl = this._backend._rowPool?.acquire() || el('div', 'el-row', { tabindex: '0', role: 'row' })
        this._rowRenderer.fillRow(rowEl, item.event, rowIdx++)
        this._selection.onRowRendered(rowEl, item.event.id)
        frag.appendChild(rowEl)
        this._activeNodes.push(rowEl)
      }
    }

    while (wrap.firstChild) wrap.removeChild(wrap.firstChild)
    wrap.appendChild(frag)
  }

  _renderGroupHeader(item) {
    const groupEl = el('div', 'el-group-header')
    groupEl.dataset.groupKey = item.key
    groupEl.setAttribute('role', 'rowgroup')
    groupEl.setAttribute('aria-expanded', String(!item.collapsed))

    const chevron = el('span', 'el-group-chevron')
    chevron.textContent = item.collapsed ? '▶' : '▼'
    chevron.setAttribute('aria-hidden', 'true')

    const label = el('span', 'el-group-label')
    label.textContent = `${this._groupEngine.field}: ${item.label}`

    const count = el('span', 'el-group-count')
    count.textContent = `(${item.count})`

    groupEl.appendChild(chevron)
    groupEl.appendChild(label)
    groupEl.appendChild(count)

    groupEl.addEventListener('click', () => {
      this._groupEngine.toggle(item.key)
      this.refresh()
    })

    return groupEl
  }

  _clearRows() {
    this._backend?.clear()
    this._activeNodes = []
  }

  _onRowClick(rowEl) {
    const eventId = rowEl.dataset.eventId
    if (!eventId) return
    this._onRowClickById(eventId, rowEl)
  }

  _onRowClickById(eventId, rowEl = null) {
    if (!eventId) return
    if (this._selection.getSelectedId() === eventId) {
      this._selection.deselect()
      this._bus.emit('event:deselected', { eventId })
      this._backend?.setSelectedId(null)
    } else {
      this._selection.select(eventId, rowEl)
      this._backend?.setSelectedId(eventId)
      this._dataSource.getRowById(eventId).then(event => {
        if (event) this._bus.emit('event:selected', { event })
      })
    }
  }

  _moveSelection(delta) {
    const currentId = this._selection.getSelectedId()
    const currentEl = this._activeNodes.find(n => n.dataset.eventId === currentId)
    if (!currentEl) {
      const first = this._activeNodes[0]
      if (first) { this._onRowClick(first); first.focus() }
      return
    }
    const idx  = this._activeNodes.indexOf(currentEl)
    const next = this._activeNodes[idx + delta]
    if (next) { this._onRowClick(next); next.focus() }
  }

  async _onSortChanged(sort) {
    if (!this._dataSource.applySort) return
    if (this._dataSource.isWorkerActive?.()) {
      await this._dataSource.applySort(sort)
    } else {
      this._dataSource.applySort?.(buildSortCompareFn(sort))
    }
    this._header.updateSortIndicator(sort.field, sort.direction)
    await this.refresh()
  }

  async _onFilterChanged() {
    const total = this._dataSource.getTotalCount?.() || 0
    this._vsEngine.setTotalCount(total)
    this._vsEngine.scrollToTop()
    await this._fetchAndRender(this._vsEngine.getVisibleRange())
  }

  _onLiveNewEvents({ events }) {
    this.prependRows(events)
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._vsEngine.destroy()
    this._badge.destroy()
    this._cm.destroy()
    this._header.destroy()
    this._backend?.destroy()
    this._el?.remove()
  }
}
