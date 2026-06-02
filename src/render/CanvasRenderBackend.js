import { RenderBackend } from './RenderBackend.js'
import { formatTimestamp, severityLabel } from '../utils/formatters.js'

const SEV_COLORS = {
  critical: '#e05252',
  high:     '#d07832',
  medium:   '#b89030',
  low:      '#4a9e52',
  info:     '#4882c5',
  unknown:  '#555555',
}

const SEV_BG = {
  critical: 'rgba(224,82,82,0.08)',
  high:     'rgba(208,120,50,0.08)',
  medium:   'rgba(184,144,48,0.08)',
  low:      'rgba(74,158,82,0.08)',
  info:     'rgba(72,130,197,0.08)',
  unknown:  'rgba(85,85,85,0.06)',
}

/**
 * CanvasRenderBackend — renders rows onto a Canvas 2D context.
 *
 * Advantages over DOM:
 *  - Virtually zero DOM node overhead (one <canvas>)
 *  - Smooth rendering at very high row counts (100k+)
 *
 * Limitations:
 *  - Custom HTMLElement renderers (plugins) not supported (falls back to text)
 *  - Accessibility: ARIA handled separately via a hidden DOM list
 */
export class CanvasRenderBackend extends RenderBackend {
  constructor(columnManager, highlightEngine, options = {}) {
    super()
    this._cm        = columnManager
    this._highlight = highlightEngine
    this._opts      = options
    this._canvas    = null
    this._ctx       = null
    this._dpr       = 1
    this._rows      = []
    this._startIdx  = 0
    this._offsetTop = 0
    this._rowHeight = options.rowHeight || 32
    this._selectedId = null
    this._container  = null
    this._ariaList   = null  // hidden DOM list for a11y
    this._width      = 0
    this._height     = 0

    // Style config (resolved from CSS variables when possible)
    this._colors = {
      bg:          options.bg          || '#0f0f0f',
      rowBorder:   options.rowBorder   || '#1e1e1e',
      text:        options.text        || '#e2e2e2',
      textMuted:   options.textMuted   || '#5c5c5c',
      textSec:     options.textSec     || '#8a8a8a',
      selectedBg:  options.selectedBg  || 'rgba(37,99,235,0.10)',
      selectedBorder: options.selectedBorder || 'rgba(37,99,235,0.5)',
      hoverBg:     options.hoverBg     || '#1c1c1c',
      font:        options.font        || '13px Inter, system-ui, sans-serif',
      fontSmall:   options.fontSmall   || '12px Inter, system-ui, sans-serif',
    }
  }

  mount(container, options = {}) {
    this._container = container
    this._rowHeight = options.rowHeight || this._rowHeight

    // Canvas element
    this._canvas = document.createElement('canvas')
    this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none'
    container.appendChild(this._canvas)

    // Hidden aria list for screen readers
    this._ariaList = document.createElement('ul')
    this._ariaList.setAttribute('role', 'list')
    this._ariaList.setAttribute('aria-label', '보안 이벤트 목록')
    this._ariaList.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap'
    container.appendChild(this._ariaList)

    // Size observer
    this._resizeObserver = new ResizeObserver(entries => {
      for (const e of entries) {
        this._resize(e.contentRect.width, e.contentRect.height)
      }
    })
    this._resizeObserver.observe(container)
    this._resize(container.clientWidth, container.clientHeight)

    // Click hit-test (container has pointer events, canvas doesn't)
    this._clickHandler = (e) => {
      const rect = container.getBoundingClientRect()
      this._lastHitX = e.clientX - rect.left
      this._lastHitY = e.clientY - rect.top
    }
    container.addEventListener('click', this._clickHandler)
  }

  renderRows(rows, startIdx, offsetTop) {
    this._rows      = rows
    this._startIdx  = startIdx
    this._offsetTop = offsetTop
    this._draw()
    this._updateAriaList()
  }

  clear() {
    this._rows = []
    if (this._ctx) {
      this._ctx.clearRect(0, 0, this._width * this._dpr, this._height * this._dpr)
    }
    if (this._ariaList) this._ariaList.innerHTML = ''
  }

  updateColumns(columns) {
    this._draw()
  }

  setSelectedId(id) {
    this._selectedId = id
    this._draw()
  }

  hitTest(clientX, clientY) {
    if (!this._container) return null
    const rect = this._container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const localY = y - this._offsetTop
    if (localY < 0) return null

    const idx = Math.floor(localY / this._rowHeight)
    const event = this._rows[idx]
    return event?.id || null
  }

  destroy() {
    this._resizeObserver?.disconnect()
    this._container?.removeEventListener('click', this._clickHandler)
    this._canvas?.remove()
    this._ariaList?.remove()
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  _resize(w, h) {
    this._width  = w
    this._height = h
    this._dpr    = window.devicePixelRatio || 1

    this._canvas.width  = Math.round(w * this._dpr)
    this._canvas.height = Math.round(h * this._dpr)
    this._canvas.style.width  = `${w}px`
    this._canvas.style.height = `${h}px`

    this._ctx = this._canvas.getContext('2d')
    this._ctx.scale(this._dpr, this._dpr)
    this._draw()
  }

  _draw() {
    const ctx = this._ctx
    if (!ctx || this._rows.length === 0) return

    const { text, textMuted, rowBorder, selectedBg, selectedBorder, bg, hoverBg } = this._colors
    const rh  = this._rowHeight
    const w   = this._width

    ctx.clearRect(0, 0, w, this._height)

    this._rows.forEach((event, i) => {
      const y   = this._offsetTop + i * rh
      const sev = event.severity || 'unknown'

      // Background
      if (event.id === this._selectedId) {
        ctx.fillStyle = selectedBg
      } else if (this._highlight?.getRowClasses(event)?.includes('el-row--highlight-critical')) {
        ctx.fillStyle = 'rgba(224,82,82,0.04)'
      } else {
        ctx.fillStyle = bg
      }
      ctx.fillRect(0, y, w, rh)

      // Selected: left border
      if (event.id === this._selectedId) {
        ctx.fillStyle = selectedBorder
        ctx.fillRect(0, y, 2, rh)
      }

      // Row divider
      ctx.fillStyle = rowBorder
      ctx.fillRect(0, y + rh - 1, w, 1)

      // Render cells
      let x = 0
      for (const col of this._cm.columns) {
        const cw = col.width || 120
        this._drawCell(ctx, col, event, x, y, cw, rh)
        x += cw
      }
    })
  }

  _drawCell(ctx, col, event, x, y, w, h) {
    const pad  = 10
    const maxW = w - pad * 2

    ctx.save()
    ctx.rect(x, y, w, h)
    ctx.clip()

    const sev = event.severity || 'unknown'

    switch (col.field) {
      case 'severity': {
        const label = severityLabel(sev).toUpperCase()
        const color = SEV_COLORS[sev] || '#555'
        const bgCol = SEV_BG[sev] || 'rgba(85,85,85,0.06)'
        // Dot
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x + pad + 4, y + h / 2, 3, 0, Math.PI * 2)
        ctx.fill()
        // Label
        ctx.fillStyle = color
        ctx.font = '10px Inter, sans-serif'
        ctx.fillText(label, x + pad + 12, y + h / 2 + 4)
        break
      }
      case 'timestamp': {
        ctx.fillStyle = this._colors.textSec
        ctx.font = '12px "JetBrains Mono", monospace'
        const ts = formatTimestamp(event.timestamp)
        this._fillTextEllipsis(ctx, ts, x + pad, y + h / 2 + 4, maxW)
        break
      }
      case 'risk_score': {
        const score = event.risk_score ?? 0
        const pct   = Math.min(100, Math.max(0, score)) / 100
        const barW  = Math.round(maxW * 0.55)
        const barH  = 3
        const barY  = y + h / 2 - barH / 2
        const color = pct >= 0.8 ? SEV_COLORS.critical
                    : pct >= 0.6 ? SEV_COLORS.high
                    : pct >= 0.4 ? SEV_COLORS.medium
                    :              SEV_COLORS.low
        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.fillRect(x + pad, barY, barW, barH)
        // Fill
        ctx.fillStyle = color
        ctx.fillRect(x + pad, barY, Math.round(barW * pct), barH)
        // Text
        ctx.fillStyle = this._colors.textMuted
        ctx.font = '11px Inter, sans-serif'
        ctx.fillText(String(score), x + pad + barW + 5, y + h / 2 + 4)
        break
      }
      default: {
        const val = event[col.field]
        const str = val != null ? String(val) : '-'
        ctx.fillStyle = this._colors.text
        ctx.font = this._colors.font
        this._fillTextEllipsis(ctx, str, x + pad, y + h / 2 + 4, maxW)
      }
    }

    // Cell divider
    ctx.fillStyle = this._colors.rowBorder
    ctx.fillRect(x + w - 1, y, 1, h)

    ctx.restore()
  }

  _fillTextEllipsis(ctx, text, x, y, maxW) {
    const measured = ctx.measureText(text).width
    if (measured <= maxW) {
      ctx.fillText(text, x, y)
      return
    }
    // Binary-search truncation
    let lo = 0, hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid
      else hi = mid - 1
    }
    ctx.fillText(text.slice(0, lo) + '…', x, y)
  }

  _updateAriaList() {
    if (!this._ariaList) return
    this._ariaList.innerHTML = ''
    for (const event of this._rows) {
      const li = document.createElement('li')
      li.textContent = `${event.severity} — ${event.rule_name || event.id} — ${event.timestamp}`
      this._ariaList.appendChild(li)
    }
  }
}
