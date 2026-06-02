import { el, on } from '../utils/dom.js'

export class HeaderRenderer {
  constructor(columnManager) {
    this._cm      = columnManager
    this._el      = null
    this._sortCol = null
    this._sortDir = 'desc'
    this._pickerEl = null
    this._pickerOpen = false
    this._cleanups = []
  }

  render(onSort, onColumnChange, pickerContainer) {
    this._el = el('div', 'el-grid-header', { role: 'row', 'aria-label': '컬럼 헤더' })
    this._onColumnChange  = onColumnChange
    this._pickerContainer = pickerContainer || null

    this._buildCells(onSort)
    this._appendColumnPicker()

    return this._el
  }

  updateAll(onSort) {
    if (!this._el) return
    while (this._el.firstChild) this._el.removeChild(this._el.firstChild)
    this._buildCells(onSort)
    // 피커 셀은 pickerContainer에 있으므로 재삽입 불필요
  }

  updateColumnWidth(col) {
    if (!this._el) return
    const cell = this._el.querySelector(`[data-col-id="${col.id}"]`)
    if (cell) {
      cell.style.width    = `${col.width}px`
      cell.style.minWidth = `${col.minWidth || 60}px`
    }
  }

  updateSortIndicator(field, direction) {
    this._sortCol = field
    this._sortDir = direction
    this._updateSortIcons()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _buildCells(onSort) {
    for (const col of this._cm.columns) {
      const cell = el('div', 'el-header-cell', {
        'data-col-id': col.id,
        draggable:     'true',
        style: `width:${col.width}px;min-width:${col.minWidth || 60}px`,
        'aria-sort': col.id === this._sortCol
          ? (this._sortDir === 'asc' ? 'ascending' : 'descending')
          : 'none',
      })

      // Drag handle
      const dragHandle = el('div', 'el-header-drag-handle', { title: '드래그하여 컬럼 이동' })
      cell.appendChild(dragHandle)

      // Label
      const labelSpan = el('span', 'el-header-label', { textContent: col.label })
      cell.appendChild(labelSpan)

      // Sort icon
      if (col.sortable !== false) {
        const sortIcon = el('span', 'el-sort-icon')
        cell.appendChild(sortIcon)
        cell.classList.add('el-sortable')

        this._cleanups.push(on(cell, 'click', (e) => {
          if (e.target.closest('.el-header-drag-handle')) return
          if (this._sortCol === col.id) {
            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc'
          } else {
            this._sortCol = col.id
            this._sortDir = 'desc'
          }
          this._updateSortIcons()
          onSort?.({ field: col.id, direction: this._sortDir })
        }))
      }

      // Resize handle
      if (col.resizable !== false) {
        const handle = el('div', 'el-col-resize-handle', { title: '드래그하여 너비 조정' })
        cell.appendChild(handle)
      }

      this._el.appendChild(cell)
    }

    // Wire drag-to-reorder
    this._cm.mountDragHandles(this._el)
  }

  _appendColumnPicker() {
    const cell = el('div', 'el-col-picker-cell')
    const btn  = el('button', 'el-col-picker-btn', {
      type:         'button',
      title:        '컬럼 순서 변경 / 표시·숨기기',
      'aria-label': '컬럼 설정',
      'aria-haspopup': 'true',
    })
    btn.innerHTML = `<span class="el-col-picker-btn-icon" aria-hidden="true">≡</span><span>컬럼</span>`

    this._cleanups.push(on(btn, 'click', (e) => {
      e.stopPropagation()
      this._togglePicker()
    }))

    cell.appendChild(btn)
    const container = this._pickerContainer || this._el
    container.appendChild(cell)
    this._pickerBtn = btn
  }

  _togglePicker() {
    if (this._pickerOpen) {
      this._closePicker()
    } else {
      this._openPicker()
    }
  }

  _openPicker() {
    this._closePicker()
    this._pickerOpen = true

    const dropdown = el('div', 'el-col-picker-dropdown')
    const header   = el('div', 'el-col-picker-header')
    header.innerHTML = '<span>컬럼 설정</span><span class="el-col-picker-hint">헤더 드래그로 순서 변경</span>'
    dropdown.appendChild(header)

    for (const col of this._cm.allColumns) {
      const item = el('div', 'el-col-picker-item')
      const checkbox = el('input', '', { type: 'checkbox', id: `el-col-${col.id}` })
      checkbox.checked = this._cm.isVisible(col.id)
      const label = el('label', '', {
        textContent: col.label,
        for: `el-col-${col.id}`,
        style: 'cursor:pointer',
      })
      on(checkbox, 'change', () => {
        this._cm.toggleVisibility(col.id)
      })
      item.appendChild(checkbox)
      item.appendChild(label)
      dropdown.appendChild(item)
    }

    // Position below the header
    const gridEl = this._el.closest('.el-grid')
    if (gridEl) {
      gridEl.style.position = 'relative'
      gridEl.appendChild(dropdown)
    } else {
      document.body.appendChild(dropdown)
    }

    this._pickerEl = dropdown

    // Close on outside click
    const closeOnOutside = (e) => {
      if (!dropdown.contains(e.target) && e.target !== this._pickerBtn) {
        this._closePicker()
        document.removeEventListener('click', closeOnOutside)
      }
    }
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0)
  }

  _closePicker() {
    this._pickerEl?.remove()
    this._pickerEl   = null
    this._pickerOpen = false
  }

  _updateSortIcons() {
    if (!this._el) return
    this._el.querySelectorAll('.el-header-cell').forEach(cell => {
      const icon  = cell.querySelector('.el-sort-icon')
      if (!icon) return
      const colId = cell.dataset.colId
      if (colId === this._sortCol) {
        icon.textContent = this._sortDir === 'asc' ? '↑' : '↓'
        cell.classList.add('el-sorted')
        cell.setAttribute('aria-sort', this._sortDir === 'asc' ? 'ascending' : 'descending')
      } else {
        icon.textContent = ''
        cell.classList.remove('el-sorted')
        cell.setAttribute('aria-sort', 'none')
      }
    })
  }

  destroy() {
    this._closePicker()
    this._cleanups.forEach(fn => fn())
    this._cleanups = []
    this._el?.remove()
  }
}
