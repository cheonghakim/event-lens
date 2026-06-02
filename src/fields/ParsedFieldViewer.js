import { el, on, escapeHtml, clearEl } from '../utils/dom.js'
import { copyToClipboard }             from '../utils/clipboard.js'
import { debounce }                    from '../utils/debounce.js'

const PINNED_FIELDS_DEFAULT = ['severity', 'risk_score', 'src_ip', 'dst_ip', 'user', 'asset', 'action', 'rule_name']

export class ParsedFieldViewer {
  constructor(options = {}, pluginCtx = null) {
    this._pinnedFields = new Set(options.pinnedFields || PINNED_FIELDS_DEFAULT)
    this._pluginCtx    = pluginCtx
    this._mode         = 'table'   // 'table' | 'json'
    this._search       = ''
    this._currentEvent = null
    this._el           = null
    this._bodyEl       = null
    this._cleanups     = []
  }

  mount(container) {
    this._el = el('div', 'ts-field-viewer')

    // Toolbar
    const toolbar = el('div', 'ts-field-toolbar')

    this._searchInput = el('input', 'ts-field-search', {
      type:         'text',
      placeholder:  '필드 검색',
      'aria-label': '필드 검색',
    })
    const searchDebounced = debounce(() => {
      this._search = this._searchInput.value.toLowerCase()
      this._renderBody(this._currentEvent)
    }, 200)
    this._cleanups.push(on(this._searchInput, 'input', searchDebounced))
    toolbar.appendChild(this._searchInput)

    const modeBtn = el('button', 'ts-field-mode-btn', {
      textContent: 'JSON',
      type:        'button',
      'aria-label': 'JSON 뷰 토글',
    })
    this._cleanups.push(on(modeBtn, 'click', () => {
      this._mode = this._mode === 'table' ? 'json' : 'table'
      modeBtn.textContent = this._mode === 'table' ? 'JSON' : '테이블'
      this._renderBody(this._currentEvent)
    }))
    toolbar.appendChild(modeBtn)

    this._el.appendChild(toolbar)

    // Body
    this._bodyEl = el('div', 'ts-field-body')
    this._el.appendChild(this._bodyEl)

    container.appendChild(this._el)
  }

  render(event) {
    this._currentEvent = event
    this._renderBody(event)
  }

  clear() {
    clearEl(this._bodyEl)
    this._currentEvent = null
  }

  _renderBody(event) {
    if (!event) { clearEl(this._bodyEl); return }

    if (this._mode === 'json') {
      this._renderJson(event)
    } else {
      this._renderTable(event)
    }
  }

  _renderTable(event) {
    clearEl(this._bodyEl)

    // Collect fields: pinned first, then parsed, then root fields
    const entries = this._collectEntries(event)

    const table = el('table', 'ts-field-table', { role: 'grid' })
    const tbody = el('tbody')

    for (const { key, value, pinned } of entries) {
      if (this._search && !key.toLowerCase().includes(this._search) &&
          !String(value).toLowerCase().includes(this._search)) continue

      const tr = el('tr', `ts-field-row${pinned ? ' ts-field-row--pinned' : ''}`)

      // Pin toggle
      const tdPin = el('td', 'ts-field-pin')
      const pinBtn = el('button', `ts-pin-btn${pinned ? ' ts-pin-btn--active' : ''}`, {
        textContent:  pinned ? '★' : '☆',
        type:         'button',
        'aria-label': `${key} 필드 고정 ${pinned ? '해제' : ''}`,
      })
      on(pinBtn, 'click', () => {
        if (this._pinnedFields.has(key)) this._pinnedFields.delete(key)
        else this._pinnedFields.add(key)
        this._renderBody(event)
      })
      tdPin.appendChild(pinBtn)
      tr.appendChild(tdPin)

      // Key
      const tdKey = el('td', 'ts-field-key', { textContent: key })
      tr.appendChild(tdKey)

      // Value
      const tdVal = el('td', 'ts-field-value')
      const pluginRenderer = this._pluginCtx?.getFieldRenderer(key)
      if (pluginRenderer) {
        const rendered = pluginRenderer(value, event)
        if (rendered instanceof HTMLElement) tdVal.appendChild(rendered)
        else tdVal.innerHTML = rendered || ''
      } else {
        tdVal.innerHTML = `<span class="ts-field-val-text">${escapeHtml(this._formatValue(value))}</span>`
      }
      tr.appendChild(tdVal)

      // Copy
      const tdCopy = el('td', 'ts-field-copy')
      const copyBtn = el('button', 'ts-field-copy-btn', {
        textContent:  '복사',
        type:         'button',
        'aria-label': `${key} 값 복사`,
      })
      on(copyBtn, 'click', () => copyToClipboard(String(value ?? '')))
      tdCopy.appendChild(copyBtn)
      tr.appendChild(tdCopy)

      tbody.appendChild(tr)
    }

    table.appendChild(tbody)
    this._bodyEl.appendChild(table)
  }

  _renderJson(event) {
    clearEl(this._bodyEl)
    const pre = el('pre', 'ts-field-json')
    pre.textContent = JSON.stringify(event, null, 2)
    const copyBtn = el('button', 'ts-field-mode-btn', {
      textContent:  'JSON 복사',
      type:         'button',
      style:        'margin-bottom:8px',
      'aria-label': 'JSON 전체 복사',
    })
    on(copyBtn, 'click', () => copyToClipboard(JSON.stringify(event, null, 2)))
    this._bodyEl.appendChild(copyBtn)
    this._bodyEl.appendChild(pre)
  }

  _collectEntries(event) {
    const entries = []
    const seen    = new Set()

    // Pinned first
    for (const key of this._pinnedFields) {
      const value = event[key] ?? event.parsed?.[key]
      if (value !== undefined) {
        entries.push({ key, value, pinned: true })
        seen.add(key)
      }
    }

    // Parsed fields
    if (event.parsed && typeof event.parsed === 'object') {
      for (const [key, value] of Object.entries(event.parsed)) {
        if (!seen.has(key)) {
          entries.push({ key, value, pinned: this._pinnedFields.has(key) })
          seen.add(key)
        }
      }
    }

    // Root fields (exclude internal ones)
    const SKIP = new Set(['id', 'raw_log', 'parsed', 'timeline'])
    for (const [key, value] of Object.entries(event)) {
      if (!SKIP.has(key) && !seen.has(key) && value !== undefined) {
        entries.push({ key, value, pinned: false })
        seen.add(key)
      }
    }

    return entries
  }

  _formatValue(value) {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._el?.remove()
  }
}
