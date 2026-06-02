import { el, escapeHtml, clearEl } from '../utils/dom.js'
import { formatTimestamp }          from '../utils/formatters.js'

// Short text codes instead of emoji — clean, readable in any font
const STEP_CODES = {
  detection:     'DET',
  alert:         'ALT',
  investigation: 'INV',
  escalation:    'ESC',
  soar_action:   'ACT',
  resolution:    'RES',
  audit:         'AUD',
}

const STEP_LABELS = {
  detection:     '탐지',
  alert:         '알림',
  investigation: '조사',
  escalation:    '에스컬레이션',
  soar_action:   'SOAR 실행',
  resolution:    '처리 완료',
  audit:         '감사 로그',
}

const STATUS_CLASS = {
  done:      'ts-tl-step--done',
  running:   'ts-tl-step--running',
  failed:    'ts-tl-step--failed',
  pending:   'ts-tl-step--pending',
  skipped:   'ts-tl-step--skipped',
  escalated: 'ts-tl-step--escalated',
}

const STATUS_LABELS = {
  done:      '완료',
  running:   '진행 중',
  failed:    '실패',
  pending:   '대기',
  skipped:   '건너뜀',
  escalated: '에스컬레이션',
}

export class EventTimeline {
  constructor(bus) {
    this._bus = bus
    this._el  = null
  }

  mount(container) {
    this._el = el('div', 'ts-event-timeline', {
      role:         'list',
      'aria-label': '처리 이력',
    })
    container.appendChild(this._el)
  }

  render(event) {
    clearEl(this._el)

    const items = event?.timeline
    if (!items || items.length === 0) {
      this._el.innerHTML = '<div class="ts-tl-empty">처리 이력이 없습니다.</div>'
      return
    }

    items.forEach((item, idx) => {
      const statusClass = STATUS_CLASS[item.status] || 'ts-tl-step--pending'
      const stepEl = el('div', `ts-tl-step ${statusClass}`, {
        role:         'listitem',
        'aria-label': `${STEP_LABELS[item.type] || item.type}: ${STATUS_LABELS[item.status] || item.status}`,
        style:        'cursor:pointer',
      })

      // Connector (not for last)
      if (idx < items.length - 1) {
        stepEl.appendChild(el('div', 'ts-tl-connector'))
      }

      // Code icon
      const code = STEP_CODES[item.type] || item.type?.slice(0,3).toUpperCase() || '···'
      stepEl.appendChild(el('div', 'ts-tl-icon', { textContent: code, title: item.type }))

      // Content
      const content = el('div', 'ts-tl-content')
      const header  = el('div', 'ts-tl-header')

      header.appendChild(el('span', 'ts-tl-type',
        { textContent: STEP_LABELS[item.type] || item.type }))

      header.appendChild(el('span', `ts-tl-status ts-tl-status--${item.status}`,
        { textContent: STATUS_LABELS[item.status] || item.status }))

      content.appendChild(header)

      if (item.time) {
        content.appendChild(el('div', 'ts-tl-time', { textContent: formatTimestamp(item.time) }))
      }

      if (item.actor) {
        content.appendChild(el('div', 'ts-tl-actor', { textContent: `담당: ${item.actor}` }))
      }

      if (item.detail) {
        content.appendChild(el('div', 'ts-tl-detail', { textContent: item.detail }))
      }

      stepEl.appendChild(content)

      stepEl.addEventListener('click', () => {
        this._bus?.emit('timeline:item-click', { item, event })
      })

      this._el.appendChild(stepEl)
    })
  }

  clear() {
    clearEl(this._el)
    if (this._el) this._el.innerHTML = '<div class="ts-tl-empty">이벤트를 선택하세요.</div>'
  }

  destroy() { this._el?.remove() }
}
