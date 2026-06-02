import { el, on, clearEl } from '../utils/dom.js'
import { formatTimestamp } from '../utils/formatters.js'

const GROUP_FIELDS = [
  { key: 'session_id', label: '세션' },
  { key: 'rule_id',    label: '룰' },
  { key: 'src_ip',     label: '출발 IP' },
  { key: 'dst_ip',     label: '목적 IP' },
  { key: 'user',       label: '사용자' },
  { key: 'asset',      label: '자산' },
]

export class RelatedEvents {
  constructor(core) {
    this._core    = core
    this._bus     = core._bus
    this._el      = null
    this._cleanups = []
  }

  mount(container) {
    this._el = el('div', 'ts-related-events', {
      role:         'region',
      'aria-label': '연관 이벤트',
    })
    container.appendChild(this._el)
  }

  async render(event) {
    if (!this._el) return
    clearEl(this._el)

    if (!event) {
      this._el.innerHTML = '<div class="ts-related-empty">이벤트를 선택하세요.</div>'
      return
    }

    const dataSource = this._core._dataSource
    let hasAny = false

    for (const { key, label } of GROUP_FIELDS) {
      const value = event[key]
      if (!value) continue

      try {
        const related = await this._findRelated(dataSource, event.id, key, value)
        if (related.length === 0) continue

        hasAny = true
        const group = el('div', 'ts-related-group')
        const groupLabel = el('div', 'ts-related-group-label', {
          textContent: `${label}: ${value} (${related.length}건)`,
        })
        group.appendChild(groupLabel)

        related.slice(0, 10).forEach(r => {
          const item = el('div', 'ts-related-item')

          const sev = el('span', 'ts-related-item-sev')
          sev.innerHTML = `<span class="ts-badge ts-badge--${r.severity || 'unknown'}">${this._sevLabel(r.severity)}</span>`

          const name = el('span', 'ts-related-item-name', { textContent: r.rule_name || r.id })
          const time = el('span', 'ts-related-item-time', { textContent: formatTimestamp(r.timestamp) })

          item.appendChild(sev)
          item.appendChild(name)
          item.appendChild(time)

          this._cleanups.push(on(item, 'click', () => {
            this._bus.emit('event:selected', { event: r })
            this._core._grid?.selectEventById(r.id)
          }))

          group.appendChild(item)
        })

        if (related.length > 10) {
          const more = el('div', 'ts-related-empty', {
            textContent: `+ ${related.length - 10}건 더 있음`,
          })
          group.appendChild(more)
        }

        this._el.appendChild(group)
      } catch {
        // Non-fatal: skip this group on error
      }
    }

    if (!hasAny) {
      this._el.innerHTML = '<div class="ts-related-empty">연관 이벤트가 없습니다.</div>'
    }
  }

  clear() {
    clearEl(this._el)
    if (this._el) {
      this._el.innerHTML = '<div class="ts-related-empty">이벤트를 선택하세요.</div>'
    }
    this._cleanups.forEach(fn => fn())
    this._cleanups = []
  }

  async _findRelated(dataSource, currentId, field, value) {
    try {
      const total = dataSource.getTotalCount?.() || 0
      // Fetch a range large enough to search through (up to 500)
      const { rows } = await dataSource.getRows({ start: 0, end: Math.min(499, total - 1) })
      return (rows || []).filter(r => r.id !== currentId && r[field] === value)
    } catch {
      return []
    }
  }

  _sevLabel(sev) {
    const map = { critical:'위험', high:'높음', medium:'보통', low:'낮음', info:'정보', unknown:'??' }
    return map[sev] || sev || '??'
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._el?.remove()
  }
}
