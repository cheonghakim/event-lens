import { el } from '../utils/dom.js'

export class NewEventBadge {
  constructor(container, onClickCallback) {
    this._count = 0
    this._el    = el('button', 'ts-new-event-badge', {
      role:         'status',
      'aria-live':  'polite',
      textContent:  '',
    })
    this._el.style.display = 'none'
    this._el.addEventListener('click', () => {
      onClickCallback?.()
      this.reset()
    })
    container.appendChild(this._el)
  }

  add(count) {
    this._count += count
    this._el.textContent  = `▼ 새 이벤트 ${this._count.toLocaleString()}건`
    this._el.style.display = ''
    this._el.setAttribute('aria-label', `새 이벤트 ${this._count}건이 도착했습니다. 클릭하여 이동`)
  }

  reset() {
    this._count            = 0
    this._el.style.display = 'none'
    this._el.textContent   = ''
  }

  getEl() {
    return this._el
  }

  destroy() {
    this._el.remove()
  }
}
