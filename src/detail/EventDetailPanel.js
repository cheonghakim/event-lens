import { el, on, setVisible } from '../utils/dom.js'
import { RawLogViewer }       from '../raw-log/RawLogViewer.js'
import { ParsedFieldViewer }  from '../fields/ParsedFieldViewer.js'
import { EventTimeline }      from '../timeline/EventTimeline.js'
import { RelatedEvents }      from '../related/RelatedEvents.js'
import { ActionBar }          from '../actions/ActionBar.js'
import { escapeHtml }         from '../utils/dom.js'
import { severityLabel }      from '../utils/formatters.js'

const TAB_LABELS = {
  parsedFields:   '필드',
  rawLog:         '원문',
  timeline:       '이력',
  relatedEvents:  '연관',
}

export class EventDetailPanel {
  constructor(core) {
    this._core      = core
    this._opts      = core._options.detail
    this._bus       = core._bus
    this._event     = null
    this._activeTab = this._opts.defaultTab || 'parsedFields'
    this._el        = null
    this._cleanups  = []

    this._panels    = {}
  }

  mount(container) {
    if (!this._opts.enabled) return

    this._el = el('div', 'ts-detail-panel', {
      role: 'complementary', 'aria-label': '이벤트 상세',
    })
    this._el.classList.add(`ts-detail-panel--${this._opts.layout}`)
    if (this._opts.layout === 'right') {
      this._el.style.width = `${this._opts.width}px`
    }

    // Header
    const header    = el('div', 'ts-detail-header')
    this._titleEl   = el('div', 'ts-detail-title', { textContent: '이벤트를 선택하세요' })
    this._closeBtn = el('button', 'ts-detail-close-btn', {
      textContent: '✕', type: 'button', 'aria-label': '닫기',
    })
    this._cleanups.push(on(this._closeBtn, 'click', () => this.clear()))
    header.appendChild(this._titleEl)
    header.appendChild(this._closeBtn)
    this._el.appendChild(header)

    // Tabs
    const availableTabs = [
      ...(this._opts.tabs || ['parsedFields', 'rawLog', 'timeline']),
      'relatedEvents',
    ]
    const tabBar = el('div', 'ts-detail-tabs', { role: 'tablist' })
    this._tabBtns = {}
    for (const tabId of availableTabs) {
      const btn = el('button', 'ts-tab-btn', {
        type: 'button', role: 'tab',
        'aria-selected': tabId === this._activeTab ? 'true' : 'false',
        'data-tab':       tabId,
        textContent:      TAB_LABELS[tabId] || tabId,
      })
      this._cleanups.push(on(btn, 'click', () => this._switchTab(tabId)))
      tabBar.appendChild(btn)
      this._tabBtns[tabId] = btn
    }
    this._el.appendChild(tabBar)

    // Content
    this._contentEl = el('div', 'ts-detail-content')

    // Instantiate all panels
    this._panels.parsedFields  = new ParsedFieldViewer({}, this._core._plugins?.ctx)
    this._panels.rawLog        = new RawLogViewer(this._core._options.detail?.rawLogOptions || {})
    this._panels.timeline      = new EventTimeline(this._bus)
    this._panels.relatedEvents = new RelatedEvents(this._core)

    for (const panel of Object.values(this._panels)) {
      panel.mount(this._contentEl)
    }

    this._el.appendChild(this._contentEl)

    // Action bar
    this._actionBar = new ActionBar(this._core)
    this._actionBar.mount(this._el)
    this._actionBar.setActions(this._core._options.actions || [])

    // Bus
    const onSel   = this._onEventSelected.bind(this)
    const onDesel = this._onEventDeselected.bind(this)
    this._bus.on('event:selected',   onSel)
    this._bus.on('event:deselected', onDesel)
    this._cleanups.push(() => {
      this._bus.off('event:selected',   onSel)
      this._bus.off('event:deselected', onDesel)
    })

    container.appendChild(this._el)
    this._syncTabVisibility()
    this.clear()
  }

  show(event) {
    this._event = event
    this._el?.classList.add('ts-detail-panel--open')
    if (this._closeBtn) this._closeBtn.style.display = ''

    const sev = event.severity || 'unknown'
    this._titleEl.innerHTML =
      `<span class="ts-badge ts-badge--${sev}">${severityLabel(sev)}</span>` +
      `<span class="ts-detail-title-text">${escapeHtml(event.rule_name || event.id || '')}</span>`

    this._panels.parsedFields?.render(event)
    this._panels.rawLog?.render(event)
    this._panels.timeline?.render(event)

    // RelatedEvents is async — only render if tab is active
    if (this._activeTab === 'relatedEvents') {
      this._panels.relatedEvents?.render(event)
    }

    this._actionBar?.render(event)
    this._syncTabVisibility()
  }

  clear() {
    this._event = null
    this._el?.classList.remove('ts-detail-panel--open')
    if (this._titleEl) this._titleEl.textContent = '이벤트를 선택하세요'
    if (this._closeBtn) this._closeBtn.style.display = 'none'
    for (const panel of Object.values(this._panels)) panel?.clear()
    this._actionBar?.clear()
  }

  _switchTab(tabId) {
    this._activeTab = tabId
    Object.entries(this._tabBtns).forEach(([id, btn]) => {
      const active = id === tabId
      btn.classList.toggle('ts-tab-btn--active', active)
      btn.setAttribute('aria-selected', String(active))
    })
    this._syncTabVisibility()

    // Lazy-render relatedEvents when tab first opened
    if (tabId === 'relatedEvents' && this._event) {
      this._panels.relatedEvents?.render(this._event)
    }
  }

  _syncTabVisibility() {
    const order = ['parsedFields', 'rawLog', 'timeline', 'relatedEvents']
    for (const id of order) {
      const panel = this._panels[id]
      if (panel?._el) setVisible(panel._el, id === this._activeTab)
    }

    // Activate tab button
    if (this._tabBtns) {
      Object.entries(this._tabBtns).forEach(([id, btn]) => {
        btn.classList.toggle('ts-tab-btn--active', id === this._activeTab)
        btn.setAttribute('aria-selected', id === this._activeTab ? 'true' : 'false')
      })
    }
  }

  _onEventSelected({ event }) { this.show(event) }
  _onEventDeselected()        { this.clear() }

  destroy() {
    this._cleanups.forEach(fn => fn())
    for (const panel of Object.values(this._panels)) panel?.destroy()
    this._actionBar?.destroy()
    this._el?.remove()
  }
}
