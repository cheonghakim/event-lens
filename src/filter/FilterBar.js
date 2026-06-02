import { el, on, clearEl } from '../utils/dom.js'
import { debounce }        from '../utils/debounce.js'
import { DateRangePicker } from '../ui/DateRangePicker.js'

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info', 'unknown']
const SEV_LABELS  = { critical:'위험', high:'높음', medium:'보통', low:'낮음', info:'정보', unknown:'기타' }

export class FilterBar {
  constructor(core) {
    this._core    = core
    this._bus     = core._bus
    this._engine  = core._filterEngine
    this._el      = null
    this._active  = {}
    this._cleanups = []
    this._chips   = null
  }

  mount(container) {
    this._el = el('div', 'ts-filter-bar', { role: 'search', 'aria-label': '이벤트 필터' })

    // ── Quick search ───────────────────────────────────────────────────────────
    const searchWrap = el('div', 'ts-filter-search-wrap')
    this._searchInput = el('input', 'ts-filter-search', {
      type:         'text',
      placeholder:  'IP / 사용자 / 룰명 / severity / action 검색',
      'aria-label': '빠른 검색',
      spellcheck:   'false',
      autocomplete: 'off',
    })
    // Pressing Escape clears search
    this._cleanups.push(on(this._searchInput, 'keydown', (e) => {
      if (e.key === 'Escape') { this._searchInput.value = ''; this._applyFilter() }
    }))
    const searchDebounced = debounce(() => this._applyFilter(), 200)
    this._cleanups.push(on(this._searchInput, 'input', searchDebounced))
    searchWrap.appendChild(this._searchInput)
    this._el.appendChild(searchWrap)

    // ── Severity toggles ──────────────────────────────────────────────────────
    const sevWrap  = el('div', 'ts-filter-severity-wrap')
    this._sevBtns  = {}
    SEVERITIES.forEach(sev => {
      const btn = el('button', `ts-sev-btn ts-sev-btn--${sev}`, {
        textContent:    SEV_LABELS[sev],
        'data-sev':     sev,
        'aria-pressed': 'false',
        type:           'button',
      })
      this._cleanups.push(on(btn, 'click', () => this._toggleSeverity(sev, btn)))
      sevWrap.appendChild(btn)
      this._sevBtns[sev] = btn
    })
    this._el.appendChild(sevWrap)

    // ── Date range picker ─────────────────────────────────────────────────────
    const timeWrap = el('div', 'ts-filter-time-wrap')
    const timeLabel = el('span', 'ts-filter-label', { textContent: '기간' })
    timeWrap.appendChild(timeLabel)

    this._datePicker = new DateRangePicker({
      onChange: ({ from, to }) => {
        if (from || to) {
          this._active.timeRange = {}
          if (from) this._active.timeRange.from = from
          if (to)   this._active.timeRange.to   = to
        } else {
          delete this._active.timeRange
        }
        this._applyFilter()
        this._renderChips()
      },
    })
    this._datePicker.mount(timeWrap)
    this._el.appendChild(timeWrap)

    // ── Clear button ──────────────────────────────────────────────────────────
    this._clearBtn = el('button', 'ts-btn ts-btn--ghost', {
      textContent: '초기화',
      type:        'button',
      'aria-label': '필터 초기화',
    })
    this._cleanups.push(on(this._clearBtn, 'click', () => this.clear()))
    this._el.appendChild(this._clearBtn)

    // ── Filter chips ──────────────────────────────────────────────────────────
    this._chips = el('div', 'ts-filter-chips', { 'aria-label': '활성 필터' })
    this._el.appendChild(this._chips)

    // ── Result count ──────────────────────────────────────────────────────────
    this._countEl = el('span', 'ts-filter-count', { 'aria-live': 'polite', 'aria-atomic': 'true' })
    this._el.appendChild(this._countEl)

    container.appendChild(this._el)

    // Update count when filter changes
    const onFilterChanged = () => this._updateCount()
    this._bus.on('filter:changed', onFilterChanged)
    this._cleanups.push(() => this._bus.off('filter:changed', onFilterChanged))
    // Also update on initial render
    requestAnimationFrame(() => this._updateCount())
  }

  clear() {
    this._active = {}
    this._searchInput.value = ''
    this._datePicker.clear()
    Object.values(this._sevBtns).forEach(btn => {
      btn.classList.remove('ts-sev-btn--active')
      btn.setAttribute('aria-pressed', 'false')
    })
    this._engine.clear()
    this._bus.emit('filter:changed', {})
    this._renderChips()
  }

  getFilter()  { return this._engine.getFilter() }

  applyFilter(filter) {
    this._engine.apply(filter)
    this._bus.emit('filter:changed', filter)
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _toggleSeverity(sev, btn) {
    if (!this._active.severity) this._active.severity = []
    const idx = this._active.severity.indexOf(sev)
    if (idx === -1) {
      this._active.severity.push(sev)
      btn.classList.add('ts-sev-btn--active')
      btn.setAttribute('aria-pressed', 'true')
    } else {
      this._active.severity.splice(idx, 1)
      btn.classList.remove('ts-sev-btn--active')
      btn.setAttribute('aria-pressed', 'false')
    }
    if (this._active.severity.length === 0) delete this._active.severity
    this._applyFilter()
    this._renderChips()
  }

  _applyFilter() {
    const filter = { ...this._active }
    const q = this._searchInput?.value.trim()
    if (q) filter.quickSearch = q
    this._engine.apply(filter)
    this._bus.emit('filter:changed', filter)
  }

  _updateCount() {
    if (!this._countEl) return
    const total = this._core._dataSource?.getTotalCount?.()
    if (total == null) { this._countEl.textContent = ''; return }
    this._countEl.textContent = `${total.toLocaleString()}건`
  }

  _renderChips() {
    if (!this._chips) return
    clearEl(this._chips)

    const filter = { ...this._active }
    const q = this._searchInput?.value.trim()
    if (q) filter.quickSearch = q

    const chips = []

    if (filter.severity?.length) {
      chips.push({
        label: `Severity: ${filter.severity.map(s => SEV_LABELS[s]).join(', ')}`,
        remove: () => {
          delete this._active.severity
          Object.values(this._sevBtns).forEach(btn => {
            btn.classList.remove('ts-sev-btn--active')
            btn.setAttribute('aria-pressed', 'false')
          })
          this._applyFilter()
          this._renderChips()
        },
      })
    }

    if (filter.timeRange) {
      const from = filter.timeRange.from?.slice(0, 10) || ''
      const to   = filter.timeRange.to?.slice(0, 10)   || ''
      chips.push({
        label: `기간: ${from}${to ? ' ~ ' + to : ''}`,
        remove: () => {
          delete this._active.timeRange
          this._datePicker.clear()
          this._applyFilter()
          this._renderChips()
        },
      })
    }

    if (filter.quickSearch) {
      chips.push({
        label: `검색: "${filter.quickSearch}"`,
        remove: () => {
          this._searchInput.value = ''
          this._applyFilter()
          this._renderChips()
        },
      })
    }

    chips.forEach(({ label, remove }) => {
      const chip = el('div', 'ts-filter-chip')
      chip.appendChild(el('span', '', { textContent: label }))
      const rmBtn = el('button', 'ts-filter-chip-remove', {
        type:         'button',
        textContent:  '×',
        'aria-label': `${label} 필터 제거`,
      })
      on(rmBtn, 'click', () => remove())
      chip.appendChild(rmBtn)
      this._chips.appendChild(chip)
    })
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._datePicker?.destroy()
    this._el?.remove()
  }
}
