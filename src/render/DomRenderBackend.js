import { RenderBackend } from './RenderBackend.js'
import { el }            from '../utils/dom.js'
import { RowPool }       from '../grid/RowPool.js'

/**
 * DomRenderBackend — thin wrapper around the existing DOM row rendering.
 * This is the default backend (renderMode: 'dom').
 */
export class DomRenderBackend extends RenderBackend {
  constructor(rowRenderer, selectionManager) {
    super()
    this._rowRenderer = rowRenderer
    this._selection   = selectionManager
    this._rowPool     = null
    this._rowsWrap    = null
    this._activeNodes = []
    this._container   = null
  }

  mount(container) {
    this._container = container
    this._rowPool   = new RowPool(() => el('div', 'el-row', { tabindex: '0', role: 'row' }))
    this._rowsWrap  = el('div', 'el-rows-container', { role: 'none' })
    container.appendChild(this._rowsWrap)
  }

  get rowsWrap() { return this._rowsWrap }
  get activeNodes() { return this._activeNodes }

  renderRows(rows, startIdx, offsetTop) {
    this._rowPool.releaseAll(this._activeNodes)
    this._activeNodes = []

    this._rowsWrap.style.transform = `translateY(${offsetTop}px)`

    const frag = document.createDocumentFragment()
    rows.forEach((event, i) => {
      const rowEl = this._rowPool.acquire()
      this._rowRenderer.fillRow(rowEl, event, startIdx + i)
      this._selection.onRowRendered(rowEl, event.id)
      frag.appendChild(rowEl)
      this._activeNodes.push(rowEl)
    })

    while (this._rowsWrap.firstChild) this._rowsWrap.removeChild(this._rowsWrap.firstChild)
    this._rowsWrap.appendChild(frag)
  }

  clear() {
    this._rowPool?.releaseAll(this._activeNodes)
    this._activeNodes = []
    while (this._rowsWrap?.firstChild) this._rowsWrap.removeChild(this._rowsWrap.firstChild)
  }

  updateColumns() {
    // Row renderer is recreated externally; re-render is triggered by caller
  }

  setSelectedId() {
    // SelectionManager handles visual state on re-render
  }

  hitTest(x, y) {
    for (const node of this._activeNodes) {
      const rect = node.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return node.dataset.eventId || null
      }
    }
    return null
  }

  destroy() {
    this._rowPool?.releaseAll(this._activeNodes)
    this._activeNodes = []
    this._rowsWrap?.remove()
  }
}
