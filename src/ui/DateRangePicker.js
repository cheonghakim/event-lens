import { el, on, clearEl } from '../utils/dom.js'

const DAYS   = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

/**
 * DateRangePicker — 브라우저 기본 datepicker 대체 컴포넌트.
 *
 * 사용:
 *   const picker = new DateRangePicker({
 *     onChange: ({ from, to }) => {}  // ISO strings
 *   })
 *   picker.mount(container)
 *   picker.getValue() → { from: '2026-01-01T00:00', to: '2026-01-31T23:59' }
 */
export class DateRangePicker {
  constructor(options = {}) {
    this._onChange = options.onChange || null
    this._value    = { from: null, to: null }   // Date objects
    this._el       = null
    this._popover  = null
    this._open     = false
    this._selecting = 'from'  // which end we're picking next
    this._viewYear  = new Date().getFullYear()
    this._viewMonth = new Date().getMonth()
    this._cleanups  = []
  }

  mount(container) {
    this._el = el('div', 'el-drp')

    // Trigger button
    this._trigger = el('button', 'el-drp-trigger el-btn', {
      type:         'button',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
    })
    this._updateTriggerText()

    this._cleanups.push(on(this._trigger, 'click', (e) => {
      e.stopPropagation()
      this._open ? this._closePopover() : this._openPopover()
    }))

    this._el.appendChild(this._trigger)
    container.appendChild(this._el)
  }

  getValue() {
    return {
      from: this._value.from ? this._toLocalISO(this._value.from) : null,
      to:   this._value.to   ? this._toLocalISO(this._value.to)   : null,
    }
  }

  setValue(from, to) {
    this._value.from = from ? new Date(from) : null
    this._value.to   = to   ? new Date(to)   : null
    this._updateTriggerText()
  }

  clear() {
    this._value = { from: null, to: null }
    this._updateTriggerText()
    this._onChange?.({ from: null, to: null })
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._closePopover()
    this._el?.remove()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _openPopover() {
    this._closePopover()
    this._open = true
    this._trigger.setAttribute('aria-expanded', 'true')

    this._popover = el('div', 'el-drp-popover')

    // Inherit theme from nearest ancestor so CSS variables resolve
    const themeRoot = this._el?.closest('[data-el-theme]')
    const theme = themeRoot?.dataset.elTheme || 'dark'
    this._popover.dataset.elTheme = theme
    // el-drp-root applies box-sizing reset and base button styles without full el-root layout
    this._popover.classList.add('el-drp-root')

    this._renderPopover()

    // Position below trigger, clamped to viewport
    const rect    = this._trigger.getBoundingClientRect()
    const popW    = 284
    const left    = Math.min(rect.left, window.innerWidth - popW - 8)
    const top     = rect.bottom + 4
    this._popover.style.cssText = `position:fixed;top:${top}px;left:${left}px;z-index:10000`

    document.body.appendChild(this._popover)

    // Close on outside click
    const closeOutside = (e) => {
      if (!this._popover?.contains(e.target) && e.target !== this._trigger) {
        this._closePopover()
        document.removeEventListener('mousedown', closeOutside)
      }
    }
    setTimeout(() => document.addEventListener('mousedown', closeOutside), 0)
    this._closeOutside = closeOutside
  }

  _closePopover() {
    this._open = false
    this._trigger?.setAttribute('aria-expanded', 'false')
    this._popover?.remove()
    this._popover = null
    if (this._closeOutside) {
      document.removeEventListener('mousedown', this._closeOutside)
      this._closeOutside = null
    }
  }

  _renderPopover() {
    clearEl(this._popover)

    // Title
    const title = el('div', 'el-drp-title')
    const fromLabel = el('span', `el-drp-range-label${this._selecting === 'from' ? ' el-drp-range-active' : ''}`,
      { textContent: this._value.from ? this._formatDate(this._value.from) : '시작일 선택' })
    const sep = el('span', 'el-drp-sep', { textContent: '→' })
    const toLabel = el('span', `el-drp-range-label${this._selecting === 'to' ? ' el-drp-range-active' : ''}`,
      { textContent: this._value.to ? this._formatDate(this._value.to) : '종료일 선택' })
    title.appendChild(fromLabel)
    title.appendChild(sep)
    title.appendChild(toLabel)
    this._popover.appendChild(title)

    // Calendar
    const calWrap = el('div', 'el-drp-cal-wrap')
    calWrap.appendChild(this._buildCalendar(this._viewYear, this._viewMonth))
    this._popover.appendChild(calWrap)

    // Time inputs
    const timeRow = el('div', 'el-drp-time-row')
    timeRow.appendChild(this._buildTimeInput('from'))
    const timeSep = el('span', 'el-drp-sep', { textContent: '~' })
    timeRow.appendChild(timeSep)
    timeRow.appendChild(this._buildTimeInput('to'))
    this._popover.appendChild(timeRow)

    // Actions
    const actions = el('div', 'el-drp-actions')
    const clearBtn = el('button', 'el-btn el-btn--ghost', { type: 'button', textContent: '초기화' })
    const applyBtn = el('button', 'el-btn el-btn--active', { type: 'button', textContent: '적용' })
    on(clearBtn, 'click', () => { this.clear(); this._closePopover() })
    on(applyBtn, 'click', () => { this._apply(); this._closePopover() })
    actions.appendChild(clearBtn)
    actions.appendChild(applyBtn)
    this._popover.appendChild(actions)
  }

  _buildCalendar(year, month) {
    const wrap = el('div', 'el-drp-cal')

    // Navigation
    const nav = el('div', 'el-drp-nav')
    const prevBtn = el('button', 'el-btn el-btn--ghost el-drp-nav-btn', { type: 'button', textContent: '‹' })
    const nextBtn = el('button', 'el-btn el-btn--ghost el-drp-nav-btn', { type: 'button', textContent: '›' })
    const monthLabel = el('span', 'el-drp-month-label', { textContent: `${year}년 ${MONTHS[month]}` })

    on(prevBtn, 'click', () => {
      if (month === 0) { this._viewYear--; this._viewMonth = 11 }
      else this._viewMonth--
      this._renderPopover()
    })
    on(nextBtn, 'click', () => {
      if (month === 11) { this._viewYear++; this._viewMonth = 0 }
      else this._viewMonth++
      this._renderPopover()
    })

    nav.appendChild(prevBtn)
    nav.appendChild(monthLabel)
    nav.appendChild(nextBtn)
    wrap.appendChild(nav)

    // Day headers
    const dayRow = el('div', 'el-drp-days-header')
    DAYS.forEach(d => dayRow.appendChild(el('span', 'el-drp-day-name', { textContent: d })))
    wrap.appendChild(dayRow)

    // Days grid
    const grid = el('div', 'el-drp-days-grid')
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(el('span', 'el-drp-day el-drp-day--empty'))
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const cell = el('button', 'el-drp-day', { type: 'button', textContent: String(d) })

      // Highlight selected range
      const from = this._value.from ? this._dayStart(this._value.from) : null
      const to   = this._value.to   ? this._dayStart(this._value.to)   : null
      const cur  = this._dayStart(date)

      if (from && cur.getTime() === from.getTime()) cell.classList.add('el-drp-day--from')
      if (to   && cur.getTime() === to.getTime())   cell.classList.add('el-drp-day--to')
      if (from && to && cur > from && cur < to)      cell.classList.add('el-drp-day--in-range')
      if (cur.getTime() === this._dayStart(new Date()).getTime()) cell.classList.add('el-drp-day--today')

      on(cell, 'click', () => this._selectDay(date))
      grid.appendChild(cell)
    }

    wrap.appendChild(grid)
    return wrap
  }

  _buildTimeInput(side) {
    const wrap  = el('div', 'el-drp-time-wrap')
    const label = el('span', 'el-drp-time-label', { textContent: side === 'from' ? '시작' : '종료' })
    const input = el('input', 'el-drp-time-input', { type: 'time', step: '60' })

    const date = this._value[side]
    if (date) {
      input.value = `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
    } else {
      input.value = side === 'from' ? '00:00' : '23:59'
    }

    on(input, 'change', () => {
      const [h, m] = input.value.split(':').map(Number)
      if (this._value[side]) {
        this._value[side].setHours(h, m, 0, 0)
      }
    })

    wrap.appendChild(label)
    wrap.appendChild(input)
    return wrap
  }

  _selectDay(date) {
    if (this._selecting === 'from') {
      this._value.from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
      this._value.to   = null
      this._selecting  = 'to'
    } else {
      if (this._value.from && date < this._value.from) {
        this._value.to   = new Date(this._value.from)
        this._value.from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
      } else {
        this._value.to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0)
      }
      this._selecting = 'from'
    }
    this._renderPopover()
  }

  _apply() {
    this._updateTriggerText()
    const v = this.getValue()
    this._onChange?.(v)
  }

  _updateTriggerText() {
    if (!this._trigger) return
    const { from, to } = this._value
    if (from && to) {
      this._trigger.textContent = `${this._formatDate(from)} — ${this._formatDate(to)}`
      this._trigger.classList.add('el-btn--active')
    } else if (from) {
      this._trigger.textContent = `${this._formatDate(from)} — 종료일 선택`
      this._trigger.classList.remove('el-btn--active')
    } else {
      this._trigger.textContent = '기간 선택'
      this._trigger.classList.remove('el-btn--active')
    }
  }

  _formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  _toLocalISO(date) {
    const y  = date.getFullYear()
    const mo = String(date.getMonth() + 1).padStart(2, '0')
    const d  = String(date.getDate()).padStart(2, '0')
    const h  = String(date.getHours()).padStart(2, '0')
    const mi = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${mo}-${d}T${h}:${mi}:00Z`
  }

  _dayStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
}
