/**
 * RenderBackend — abstract interface for row rendering.
 *
 * Implementations:
 *   DomRenderBackend   — default, wraps existing DOM-based RowRenderer
 *   CanvasRenderBackend — Canvas 2D renderer for ultra-high-row-count scenarios
 */
export class RenderBackend {
  /**
   * Mount the backend into the given container element.
   * @param {HTMLElement} container
   * @param {object} options
   */
  mount(container, options) { throw new Error('RenderBackend.mount() not implemented') }

  /**
   * Render a window of rows.
   * @param {object[]} rows  — SecurityEvent array
   * @param {number}   startIdx
   * @param {number}   offsetTop — px from top of scroll spacer
   */
  renderRows(rows, startIdx, offsetTop) { throw new Error('RenderBackend.renderRows() not implemented') }

  /**
   * Clear all rendered rows.
   */
  clear() {}

  /**
   * Called when column widths / visibility change.
   * @param {object[]} columns
   */
  updateColumns(columns) {}

  /**
   * Called when the selected row id changes.
   * @param {string|null} selectedId
   */
  setSelectedId(selectedId) {}

  /**
   * Handle a pointer click — return the row element or event id at (x, y),
   * or null if nothing was hit.
   * @param {number} x
   * @param {number} y
   * @returns {string|null} event id
   */
  hitTest(x, y) { return null }

  /**
   * Release all DOM/Canvas resources.
   */
  destroy() {}
}
