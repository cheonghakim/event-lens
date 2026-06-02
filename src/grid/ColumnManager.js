import { on } from '../utils/dom.js'

export class ColumnManager {
  constructor(columns) {
    this._all             = columns.map(c => ({ ...c }))   // all defined columns
    this._visible         = new Set(this._all.filter(c => c.visible !== false).map(c => c.id))
    this._order           = this._all.map(c => c.id)
    this._cleanups        = []
    this._changeListeners = []
  }

  /** Ordered, visible columns only */
  get columns() {
    return this._order
      .filter(id => this._visible.has(id))
      .map(id => this._all.find(c => c.id === id))
      .filter(Boolean)
  }

  /** All columns (including hidden) */
  get allColumns() {
    return this._order.map(id => this._all.find(c => c.id === id)).filter(Boolean)
  }

  isVisible(id)   { return this._visible.has(id) }

  toggleVisibility(id) {
    if (this._visible.has(id)) this._visible.delete(id)
    else                        this._visible.add(id)
    this._notify()
  }

  setVisibility(id, visible) {
    if (visible) this._visible.add(id)
    else         this._visible.delete(id)
    this._notify()
  }

  getTotalWidth() {
    return this.columns.reduce((sum, c) => sum + (c.width || 120), 0)
  }

  /** Move column from fromIdx to toIdx (in visible columns) */
  moveColumn(fromId, toId) {
    const fi = this._order.indexOf(fromId)
    const ti = this._order.indexOf(toId)
    if (fi === -1 || ti === -1 || fi === ti) return
    this._order.splice(fi, 1)
    this._order.splice(ti, 0, fromId)
    this._notify()
  }

  onChange(fn) { this._changeListeners.push(fn) }

  mountResizeHandles(headerEl, onWidthChange) {
    const handles = headerEl.querySelectorAll('.el-col-resize-handle')
    const cols    = this.columns

    handles.forEach((handle, i) => {
      const col = cols[i]
      if (!col) return

      let startX = 0
      let startW = 0

      const onMouseDown = (e) => {
        e.preventDefault()
        e.stopPropagation()
        startX = e.clientX
        startW = col.width || 120

        handle.classList.add('el-resizing')

        const onMouseMove = (e) => {
          const delta = e.clientX - startX
          col.width = Math.max(col.minWidth || 60, startW + delta)
          onWidthChange?.(col, i)
        }
        const onMouseUp = () => {
          handle.classList.remove('el-resizing')
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
        }
        document.addEventListener('mousemove', onMouseMove)
        document.addEventListener('mouseup', onMouseUp)
      }

      this._cleanups.push(on(handle, 'mousedown', onMouseDown))
    })
  }

  mountDragHandles(headerEl) {
    const cells = headerEl.querySelectorAll('.el-header-cell[data-col-id]')
    let draggingId = null

    cells.forEach(cell => {
      const colId = cell.dataset.colId

      this._cleanups.push(on(cell, 'dragstart', (e) => {
        draggingId = colId
        cell.classList.add('el-dragging')
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', colId)
      }))

      this._cleanups.push(on(cell, 'dragend', () => {
        draggingId = null
        cell.classList.remove('el-dragging')
        headerEl.querySelectorAll('.el-drag-over').forEach(el => el.classList.remove('el-drag-over'))
      }))

      this._cleanups.push(on(cell, 'dragover', (e) => {
        if (!draggingId || draggingId === colId) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        headerEl.querySelectorAll('.el-drag-over').forEach(el => el.classList.remove('el-drag-over'))
        cell.classList.add('el-drag-over')
      }))

      this._cleanups.push(on(cell, 'dragleave', () => {
        cell.classList.remove('el-drag-over')
      }))

      this._cleanups.push(on(cell, 'drop', (e) => {
        e.preventDefault()
        const fromId = e.dataTransfer.getData('text/plain')
        cell.classList.remove('el-drag-over')
        if (fromId && fromId !== colId) {
          this.moveColumn(fromId, colId)
        }
      }))
    })
  }

  _notify() {
    this._changeListeners.forEach(fn => fn())
  }

  destroy() {
    this._cleanups.forEach(fn => fn())
    this._cleanups = []
  }
}
