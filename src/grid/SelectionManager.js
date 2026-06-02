export class SelectionManager {
  constructor(bus) {
    this._bus         = bus
    this._selectedId  = null
    this._selectedRow = null
  }

  select(eventId, rowEl) {
    // Deselect previous
    if (this._selectedRow) {
      this._selectedRow.classList.remove('el-row--selected')
      this._selectedRow.setAttribute('aria-selected', 'false')
    }

    this._selectedId  = eventId
    this._selectedRow = rowEl

    if (rowEl) {
      rowEl.classList.add('el-row--selected')
      rowEl.setAttribute('aria-selected', 'true')
    }

    this._bus.emit('grid:row-selected', { eventId })
  }

  deselect() {
    if (this._selectedRow) {
      this._selectedRow.classList.remove('el-row--selected')
      this._selectedRow.setAttribute('aria-selected', 'false')
    }
    this._selectedId  = null
    this._selectedRow = null
    this._bus.emit('grid:row-deselected', {})
  }

  getSelectedId() {
    return this._selectedId
  }

  // Called when rows are re-rendered (virtual scroll) — re-apply visual selection
  onRowRendered(rowEl, eventId) {
    if (eventId === this._selectedId) {
      rowEl.classList.add('el-row--selected')
      rowEl.setAttribute('aria-selected', 'true')
      this._selectedRow = rowEl
    } else {
      rowEl.classList.remove('el-row--selected')
      rowEl.setAttribute('aria-selected', 'false')
    }
  }
}
