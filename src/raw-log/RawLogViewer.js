import { el, on, escapeHtml } from '../utils/dom.js'
import { LogTokenizer }       from './LogTokenizer.js'
import { copyToClipboard }    from '../utils/clipboard.js'

export class RawLogViewer {
  constructor(options = {}) {
    this._tokenizer = new LogTokenizer()
    this._wrap      = options.wrap      || 'soft'  // 'none' | 'soft'
    this._masking   = options.masking   || null
    this._masked    = false
    this._el        = null
    this._logEl     = null
    this._cleanups  = []
  }

  mount(container) {
    this._el = el('div', 'ts-raw-log-viewer')

    // Toolbar
    const toolbar = el('div', 'ts-raw-log-toolbar')

    const copyBtn = el('button', 'ts-raw-log-btn', {
      textContent: '복사',
      type:        'button',
      'aria-label': '원문 로그 복사',
    })
    this._cleanups.push(on(copyBtn, 'click', () => this._copyLog()))
    toolbar.appendChild(copyBtn)

    const wrapBtn = el('button', 'ts-raw-log-btn', {
      textContent: '줄바꿈',
      type:        'button',
      'aria-label': '줄바꿈 토글',
    })
    this._cleanups.push(on(wrapBtn, 'click', () => this._toggleWrap()))
    toolbar.appendChild(wrapBtn)

    if (this._masking?.enabled) {
      const maskBtn = el('button', 'ts-raw-log-btn', {
        textContent: '마스킹',
        type:        'button',
        'aria-label': '민감 정보 마스킹 토글',
      })
      this._cleanups.push(on(maskBtn, 'click', () => {
        this._masked = !this._masked
        maskBtn.textContent = this._masked ? '원문보기' : '마스킹'
        if (this._currentLog) this._renderLog(this._currentLog)
      }))
      toolbar.appendChild(maskBtn)
    }

    this._el.appendChild(toolbar)

    // Log area
    this._logEl = el('pre', `ts-raw-log-content ts-raw-log--${this._wrap}`, {
      role:         'region',
      'aria-label': '원문 로그',
      tabindex:     '0',
    })
    this._el.appendChild(this._logEl)

    container.appendChild(this._el)
  }

  render(event) {
    this._currentEvent = event
    this._currentLog   = event?.raw_log || ''
    this._renderLog(this._currentLog)
  }

  clear() {
    if (this._logEl) this._logEl.innerHTML = '<span class="ts-raw-log-empty">로그 없음</span>'
    this._currentLog   = ''
    this._currentEvent = null
  }

  _renderLog(raw) {
    if (!this._logEl) return
    let text = raw
    if (this._masked && this._masking?.enabled) {
      for (const field of (this._masking.fields || [])) {
        const pattern = this._masking.pattern || '***'
        text = text.replace(new RegExp(field + '[=: ]+\\S+', 'gi'), `${field}=${pattern}`)
      }
    }

    const tokens = this._tokenizer.tokenize(text)
    this._logEl.innerHTML = tokens.map(t => this._renderToken(t)).join('')
  }

  _renderToken({ type, value }) {
    const safe = escapeHtml(value)
    if (type === 'text') return safe
    return `<span class="ts-token ts-token--${type}" title="${type}">${safe}</span>`
  }

  _copyLog() {
    const text = this._currentLog || ''
    copyToClipboard(text).then(() => {
      this._showCopyFeedback()
    })
  }

  _showCopyFeedback() {
    const badge = el('span', 'ts-copy-feedback', { textContent: '복사됨!' })
    this._el.appendChild(badge)
    setTimeout(() => badge.remove(), 1500)
  }

  _toggleWrap() {
    this._wrap = this._wrap === 'none' ? 'soft' : 'none'
    if (this._logEl) {
      this._logEl.className = `ts-raw-log-content ts-raw-log--${this._wrap}`
    }
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._el?.remove()
  }
}
