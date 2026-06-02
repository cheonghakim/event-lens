import { el } from '../utils/dom.js'

export class LiveStatusBar {
  constructor(bus) {
    this._bus      = bus
    this._el       = null
    this._dotEl    = null
    this._textEl   = null
    this._countEl  = null
    this._paused   = false
    this._total    = 0
  }

  mount(container) {
    this._el = el('div', 'ts-live-status-bar', { role: 'status', 'aria-live': 'polite' })

    this._dotEl  = el('span', 'ts-live-dot ts-live-dot--connecting', { title: '연결 중' })
    this._textEl = el('span', 'ts-live-text', { textContent: '연결 중...' })
    this._countEl= el('span', 'ts-live-count', { textContent: '' })

    this._pauseBtn = el('button', 'ts-live-pause-btn', {
      textContent:  '⏸ 일시정지',
      type:         'button',
      'aria-label': 'Live 일시정지',
    })
    this._pauseBtn.addEventListener('click', () => {
      this._bus.emit(this._paused ? 'live:resume' : 'live:pause', {})
    })

    this._el.appendChild(this._dotEl)
    this._el.appendChild(this._textEl)
    this._el.appendChild(this._countEl)
    this._el.appendChild(this._pauseBtn)

    container.appendChild(this._el)

    this._bus.on('live:connected',    () => this._setConnected())
    this._bus.on('live:disconnected', () => this._setDisconnected())
    this._bus.on('live:paused',       () => this._setPaused())
    this._bus.on('live:resumed',      () => this._setResumed())
    this._bus.on('live:new-events',   ({ count }) => this._addCount(count))
  }

  _setConnected() {
    this._dotEl.className  = 'ts-live-dot ts-live-dot--connected'
    this._textEl.textContent = 'Live 연결됨'
    this._dotEl.title      = '연결됨'
  }

  _setDisconnected() {
    this._dotEl.className  = 'ts-live-dot ts-live-dot--disconnected'
    this._textEl.textContent = '연결 끊김'
    this._dotEl.title      = '연결 끊김'
  }

  _setPaused() {
    this._paused           = true
    this._dotEl.className  = 'ts-live-dot ts-live-dot--paused'
    this._textEl.textContent = '일시정지'
    this._pauseBtn.textContent = '▶ 재개'
    this._pauseBtn.setAttribute('aria-label', 'Live 재개')
  }

  _setResumed() {
    this._paused           = false
    this._dotEl.className  = 'ts-live-dot ts-live-dot--connected'
    this._textEl.textContent = 'Live 연결됨'
    this._pauseBtn.textContent = '⏸ 일시정지'
    this._pauseBtn.setAttribute('aria-label', 'Live 일시정지')
  }

  _addCount(n) {
    this._total += n
    this._countEl.textContent = `+${this._total.toLocaleString()}건`
  }

  hide() {
    if (this._el) this._el.style.display = 'none'
  }

  destroy() {
    this._el?.remove()
  }
}
