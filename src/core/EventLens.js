import { EventBus }         from './EventBus.js'
import { normalizeOptions } from './OptionsNormalizer.js'
import { PluginRegistry }   from './PluginRegistry.js'
import { StateManager }     from './StateManager.js'
import { createDataSource } from '../data-source/DataSourceFactory.js'
import { HighlightEngine }  from '../highlight/HighlightEngine.js'
import { FilterEngine }     from '../filter/FilterEngine.js'
import { FilterBar }        from '../filter/FilterBar.js'
import { EventGrid }        from '../grid/EventGrid.js'
import { EventDetailPanel } from '../detail/EventDetailPanel.js'
import { LiveController }   from '../live/LiveController.js'
import { LiveStatusBar }    from '../live/LiveStatusBar.js'
import { WorkerBridge }     from '../worker/WorkerBridge.js'
import { el }               from '../utils/dom.js'

// Static plugin registry (class-level)
const _staticPlugins = []

export class EventLens {
  static use(plugin) {
    _staticPlugins.push(plugin)
    return EventLens
  }

  constructor(options) {
    this._options    = normalizeOptions(options)
    this._bus        = new EventBus()
    this._plugins    = new PluginRegistry(this)
    this._stateMgr   = this._options.storageKey !== false
      ? new StateManager({ storageKey: this._options.storageKey || 'event-lens-state' })
      : null

    const rawAdapter = createDataSource(this._options.dataSource)

    // Wrap in WorkerBridge if worker mode is enabled
    if (this._options.worker.enabled && !rawAdapter.isServerSide?.()) {
      this._dataSource = new WorkerBridge(rawAdapter, {
        maxTotalRows: this._options.live.maxTotalRows,
      })
    } else {
      this._dataSource = rawAdapter
    }

    this._highlight    = new HighlightEngine(this._options.highlightRules)
    this._filterEngine = new FilterEngine(this._dataSource)

    // Resolve container
    this._container = typeof this._options.container === 'string'
      ? document.querySelector(this._options.container)
      : this._options.container

    if (!this._container) throw new Error('[EventLens] container element not found')

    // Install static plugins first, then instance plugins
    for (const p of _staticPlugins)          this._plugins.register(p)
    for (const p of this._options.plugins)   this._plugins.register(p)

    this._mount()
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  on(event, cb)  { this._bus.on(event, cb);  return this }
  off(event, cb) { this._bus.off(event, cb); return this }
  emit(event, d) { this._bus.emit(event, d) }

  use(plugin) {
    this._plugins.register(plugin)
    return this
  }

  setDataSource(dataSource) {
    const rawAdapter = createDataSource(dataSource)

    if (this._options.worker.enabled && !rawAdapter.isServerSide?.()) {
      if (this._dataSource instanceof WorkerBridge) this._dataSource.destroy()
      this._dataSource = new WorkerBridge(rawAdapter, {
        maxTotalRows: this._options.live.maxTotalRows,
      })
    } else {
      this._dataSource = rawAdapter
    }

    this._filterEngine = new FilterEngine(this._dataSource)
    if (this._grid) this._grid._dataSource = this._dataSource
    this.refresh()
  }

  async refresh() {
    await this._grid?.refresh()
  }

  scrollToRow(id) {
    // Find index in current data — simple linear search for MVP
    this._dataSource.getRowById(id).then(event => {
      if (!event) return
      // We don't track index here in Phase 1; delegate to grid
      this._grid?.selectEventById(id)
    })
  }

  scrollToIndex(index) {
    this._grid?.scrollToIndex(index)
  }

  scrollToTop()    { this._grid?.scrollToTop()    }
  scrollToBottom() { this._grid?.scrollToBottom() }

  selectEvent(id) {
    this._dataSource.getRowById(id).then(event => {
      if (event) this._bus.emit('event:selected', { event })
    })
  }

  getSelectedEvent() {
    const id = this._grid?.getSelectedId()
    return id ? this._dataSource.getRowById(id) : Promise.resolve(null)
  }

  clearSelection() {
    const id = this._grid?.getSelectedId()
    this._grid?._selection.deselect()
    if (id) this._bus.emit('event:deselected', { eventId: id })
  }

  applyFilter(filter) {
    this._filterEngine.apply(filter)
    this._bus.emit('filter:changed', filter)
    this._stateMgr?.saveFilter(filter)
  }

  clearFilter() {
    this._filterEngine.clear()
    this._bus.emit('filter:changed', {})
    this._stateMgr?.clearFilter()
  }

  getFilter() {
    return this._filterEngine.getFilter()
  }

  setSort(sort) {
    this._bus.emit('sort:changed', sort)
  }

  pauseLive() {
    this._liveController?.pause()
  }

  resumeLive() {
    this._liveController?.resume()
  }

  isLivePaused() {
    return this._liveController?.isPaused() ?? false
  }

  isWorkerActive() {
    return this._dataSource instanceof WorkerBridge
      ? this._dataSource.isWorkerActive()
      : false
  }

  destroy() {
    this._liveController?.destroy()
    this._grid?.destroy()
    this._detailPanel?.destroy()
    this._filterBar?.destroy()
    this._liveStatusBar?.destroy()
    if (this._dataSource instanceof WorkerBridge) this._dataSource.destroy()
    else this._dataSource.destroy?.()
    this._bus.clear()
    this._rootEl?.remove()
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _mount() {
    const opts = this._options

    // Root element
    this._rootEl = el('div', 'el-root')
    this._rootEl.dataset.elTheme   = opts.theme
    this._rootEl.dataset.elDensity = opts.density
    this._container.appendChild(this._rootEl)

    // Toolbar (FilterBar + LiveStatusBar)
    const toolbar = el('div', 'el-toolbar')
    this._rootEl.appendChild(toolbar)

    this._filterBar = new FilterBar(this)
    this._filterBar.mount(toolbar)

    if (opts.live.enabled) {
      this._liveStatusBar = new LiveStatusBar(this._bus)
      this._liveStatusBar.mount(toolbar)
    }

    // Content area
    const content = el('div', 'el-content')
    this._rootEl.appendChild(content)

    // Grid area
    const gridArea = el('div', 'el-grid-area')
    content.appendChild(gridArea)

    this._grid = new EventGrid(this)
    this._grid.mount(gridArea)

    // Detail panel
    if (opts.detail.enabled) {
      const detailArea = el('div', 'el-detail-area')
      if (opts.detail.layout === 'right') {
        detailArea.style.width = `${opts.detail.width}px`
      }
      content.appendChild(detailArea)

      this._detailPanel = new EventDetailPanel(this)
      this._detailPanel.mount(detailArea)
    }

    // Live controller
    if (opts.live.enabled) {
      this._liveController = new LiveController(this)
      this._liveController.start()
    }

    // Load initial data
    this._grid.load()

    // ── State restoration ─────────────────────────────────────────────────────
    if (this._stateMgr) {
      // Column state (order / visibility / widths)
      if (this._grid._cm) {
        const restored = this._stateMgr.restoreColumns(this._grid._cm)
        if (restored) this._grid._rebuildAfterColumnChange()
      }

      // Saved filter
      const savedFilter = this._stateMgr.restoreFilter()
      if (savedFilter) {
        this._filterEngine.apply(savedFilter)
        this._bus.emit('filter:changed', savedFilter)
      }
    }

    // Auto-save column state on every column change
    if (this._stateMgr && this._grid._cm) {
      this._grid._cm.onChange(() => {
        this._stateMgr.saveColumns(this._grid._cm)
      })
    }
  }
}
