import { escapeHtml, el } from '../utils/dom.js'
import { formatTimestamp, severityLabel } from '../utils/formatters.js'

export class RowRenderer {
  constructor(columnManager, highlightEngine, pluginCtx) {
    this._cm        = columnManager
    this._highlight = highlightEngine
    this._pluginCtx = pluginCtx
  }

  fillRow(rowEl, event, rowIndex) {
    rowEl.dataset.eventId   = event.id
    rowEl.dataset.rowIndex  = rowIndex
    rowEl.setAttribute('role', 'row')
    rowEl.setAttribute('aria-rowindex', rowIndex + 1)

    // Apply highlight classes
    const extraClasses = this._highlight ? this._highlight.getRowClasses(event) : []
    rowEl.className = ['el-row', `el-row--${event.severity || 'unknown'}`, ...extraClasses].join(' ')

    // Render cells
    const cells = rowEl.querySelectorAll('.el-cell')
    const cols  = this._cm.columns

    if (cells.length !== cols.length) {
      this._rebuildCells(rowEl, event)
    } else {
      cols.forEach((col, i) => {
        this._fillCell(cells[i], col, event)
      })
    }

    const decorators = this._pluginCtx?.getRowDecorators()
    if (decorators?.length) {
      for (const fn of decorators) fn(rowEl, event)
    }
  }

  createRow(event, rowIndex) {
    const rowEl = el('div', 'el-row', {
      role: 'row',
      tabindex: '0',
      'aria-rowindex': rowIndex + 1,
      'data-event-id': event.id,
      'data-row-index': rowIndex,
    })
    rowEl.className = ['el-row', `el-row--${event.severity || 'unknown'}`].join(' ')

    for (const col of this._cm.columns) {
      const cell = el('div', 'el-cell', {
        'data-col-id':  col.id,
        style: `width:${col.width}px;min-width:${col.minWidth || 60}px`,
      })
      this._fillCell(cell, col, event)
      rowEl.appendChild(cell)
    }

    return rowEl
  }

  _rebuildCells(rowEl, event) {
    while (rowEl.firstChild) rowEl.removeChild(rowEl.firstChild)
    for (const col of this._cm.columns) {
      const cell = el('div', 'el-cell', {
        'data-col-id': col.id,
        style: `width:${col.width}px;min-width:${col.minWidth || 60}px`,
      })
      this._fillCell(cell, col, event)
      rowEl.appendChild(cell)
    }
  }

  _fillCell(cellEl, col, event) {
    cellEl.style.width    = `${col.width}px`
    cellEl.style.minWidth = `${col.minWidth || 60}px`
    cellEl.dataset.colId  = col.id

    // Plugin field renderer takes priority
    const pluginRenderer = this._pluginCtx?.getFieldRenderer(col.field)
    if (pluginRenderer) {
      const result = pluginRenderer(event[col.field], event)
      if (result instanceof HTMLElement) {
        cellEl.innerHTML = ''
        cellEl.appendChild(result)
      } else {
        cellEl.innerHTML = result || ''
      }
      return
    }

    // Column-level custom renderer
    if (col.renderer) {
      const result = col.renderer(event[col.field], event, col)
      if (result instanceof HTMLElement) {
        cellEl.innerHTML = ''
        cellEl.appendChild(result)
      } else {
        cellEl.innerHTML = result || ''
      }
      return
    }

    // Built-in renderers
    switch (col.field) {
      case 'severity':
        cellEl.innerHTML = this._renderSeverityBadge(event.severity)
        break
      case 'timestamp':
        cellEl.innerHTML = `<span class="el-cell-time">${escapeHtml(formatTimestamp(event.timestamp))}</span>`
        break
      case 'risk_score':
        cellEl.innerHTML = this._renderRiskScore(event.risk_score)
        break
      default: {
        const val = event[col.field]
        cellEl.innerHTML = `<span class="el-cell-text">${escapeHtml(val != null ? String(val) : '-')}</span>`
      }
    }
  }

  _renderSeverityBadge(severity) {
    const sev   = severity || 'unknown'
    const label = severityLabel(sev)
    return `<span class="el-badge el-badge--${sev}" aria-label="Severity: ${sev}">${label}</span>`
  }

  _renderRiskScore(score) {
    if (score == null) return '<span class="el-cell-text">-</span>'
    const pct   = Math.min(100, Math.max(0, score))
    const color = pct >= 80 ? 'var(--el-color-critical)'
                : pct >= 60 ? 'var(--el-color-high)'
                : pct >= 40 ? 'var(--el-color-medium)'
                :              'var(--el-color-low)'
    return `<span class="el-risk-bar" title="${pct}">
      <span class="el-risk-fill" style="width:${pct}%;background:${color}"></span>
      <span class="el-risk-text">${pct}</span>
    </span>`
  }

  updateColumnWidths(rowEl) {
    const cells = rowEl.querySelectorAll('.el-cell')
    this._cm.columns.forEach((col, i) => {
      if (cells[i]) {
        cells[i].style.width    = `${col.width}px`
        cells[i].style.minWidth = `${col.minWidth || 60}px`
      }
    })
  }
}
