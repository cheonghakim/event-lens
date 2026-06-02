import { el, on }                             from '../utils/dom.js'
import { copyToClipboard, eventToText, eventToJson } from '../utils/clipboard.js'

const BUILTIN_ACTIONS = [
  {
    id:      'copy-text',
    label:   '텍스트 복사',
    icon:    '⎘',
    builtin: true,
    group:   'copy',
    handler: async (event) => { await copyToClipboard(eventToText(event)) },
  },
  {
    id:      'copy-json',
    label:   'JSON 복사',
    icon:    '{ }',
    builtin: true,
    group:   'copy',
    handler: async (event) => { await copyToClipboard(eventToJson(event)) },
  },
]

export class ActionBar {
  constructor(core) {
    this._core     = core
    this._bus      = core._bus
    this._actions  = []
    this._el       = null
    this._cleanups = []
  }

  mount(container) {
    this._el = el('div', 'ts-action-bar', { role: 'toolbar', 'aria-label': '이벤트 액션' })
    container.appendChild(this._el)
  }

  setActions(userActions = []) {
    const pluginActions = this._core._plugins?.ctx?.getActions() || []
    this._actions = [
      ...BUILTIN_ACTIONS,
      ...userActions.map(a => ({ ...a, group: a.group || 'user' })),
      ...pluginActions.map(a => ({ ...a, group: a.group || 'plugin' })),
    ]
  }

  render(event) {
    this._currentEvent = event
    while (this._el.firstChild) this._el.removeChild(this._el.firstChild)
    this._cleanups.forEach(fn => fn())
    this._cleanups = []

    // Group actions and insert separators between groups
    let lastGroup = null
    for (const action of this._actions) {
      const group = action.group || 'other'

      if (lastGroup !== null && lastGroup !== group) {
        this._el.appendChild(el('span', 'ts-action-sep', { 'aria-hidden': 'true' }))
      }
      lastGroup = group

      const disabled = typeof action.disabled === 'function'
        ? action.disabled(event)
        : (action.disabled === true)

      const cls = [
        'ts-action-btn',
        disabled ? 'ts-action-btn--disabled' : '',
        action.builtin ? 'ts-action-btn--builtin' : '',
      ].filter(Boolean).join(' ')

      const btn = el('button', cls, {
        type:         'button',
        'aria-label': action.label,
      })

      // Icon badge
      if (action.icon) {
        const iconEl = el('span', 'ts-action-icon-badge', { 'aria-hidden': 'true' })
        iconEl.textContent = action.icon
        btn.appendChild(iconEl)
      }

      const labelEl = el('span', 'ts-action-label')
      labelEl.textContent = action.label
      btn.appendChild(labelEl)

      if (disabled) btn.setAttribute('disabled', 'true')

      if (!disabled) {
        this._cleanups.push(on(btn, 'click', async () => {
          try {
            await action.handler(event, {
              viewer: this._core,
              emit:   (ev, d) => this._bus.emit(ev, d),
            })
            this._bus.emit('event:action', { actionId: action.id, event })
            this._flash(labelEl, '완료')
          } catch (e) {
            console.error(`[TraceScope] Action "${action.id}" failed:`, e)
            this._flash(labelEl, '오류')
          }
        }))
      }

      this._el.appendChild(btn)
    }
  }

  _flash(btn, text) {
    const orig = btn.textContent
    btn.textContent = text
    setTimeout(() => { if (btn.isConnected) btn.textContent = orig }, 1400)
  }

  clear() {
    this._currentEvent = null
    while (this._el?.firstChild) this._el.removeChild(this._el.firstChild)
    this._cleanups.forEach(fn => fn())
    this._cleanups = []
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._el?.remove()
  }
}
