/**
 * GroupingEngine — groups flat SecurityEvent rows by a key field.
 *
 * Output is a "flat grouped list" where group header rows are
 * interleaved with event rows. Each item is either:
 *   { type: 'group', key, label, count, collapsed }
 *   { type: 'row',   event, groupKey }
 *
 * Usage:
 *   const ge = new GroupingEngine({ field: 'src_ip' })
 *   const flat = ge.build(events)
 *   const visible = ge.flatRows(flat)  // skips collapsed group children
 */
export class GroupingEngine {
  constructor(options = {}) {
    this._field     = options.field     || 'src_ip'
    this._sortKeys  = options.sortKeys  !== false  // sort group headers alphabetically
    this._maxGroups = options.maxGroups || 500
    this._collapsed = new Set()
  }

  get field() { return this._field }

  setField(field) {
    this._field = field
    this._collapsed.clear()
  }

  toggle(key) {
    if (this._collapsed.has(key)) this._collapsed.delete(key)
    else this._collapsed.add(key)
  }

  collapse(key) { this._collapsed.add(key) }
  expand(key)   { this._collapsed.delete(key) }
  expandAll()   { this._collapsed.clear() }
  collapseAll(keys) { keys.forEach(k => this._collapsed.add(k)) }
  isCollapsed(key)  { return this._collapsed.has(key) }

  /**
   * Build the grouped structure from a flat events array.
   * @param {object[]} events
   * @returns {object[]}  — flat list with group + row items
   */
  build(events) {
    const groups = new Map()  // key → { events: [] }

    for (const event of events) {
      const key = String(event[this._field] ?? '(blank)')
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(event)
    }

    let keys = [...groups.keys()]
    if (this._sortKeys) keys.sort()

    const flat = []
    for (const key of keys) {
      const groupEvents = groups.get(key)
      flat.push({
        type:      'group',
        key,
        label:     key,
        count:     groupEvents.length,
        collapsed: this._collapsed.has(key),
      })
      if (!this._collapsed.has(key)) {
        for (const event of groupEvents) {
          flat.push({ type: 'row', event, groupKey: key })
        }
      }
    }

    return flat
  }

  /**
   * Returns only the visible (non-collapsed) rows as SecurityEvents,
   * plus group header sentinels, for the virtual scroll engine.
   */
  flatRows(grouped) {
    return grouped
  }
}
