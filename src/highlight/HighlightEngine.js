export class HighlightEngine {
  constructor(rules = []) {
    this._rules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    this._cache = new Map()
    this._maxCache = 5000
  }

  setRules(rules) {
    this._rules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    this._cache.clear()
  }

  getRowClasses(event) {
    const cached = this._cache.get(event.id)
    if (cached) return cached

    const classes = []
    for (const rule of this._rules) {
      if (rule.type === 'token') continue  // token rules are for RawLogViewer
      if (rule.when && rule.when(event)) {
        if (rule.className) classes.push(rule.className)
      } else if (rule.field && rule.match) {
        const val = String(event[rule.field] ?? '')
        const matched = rule.match instanceof RegExp
          ? rule.match.test(val)
          : val === String(rule.match)
        if (matched && rule.className) classes.push(rule.className)
      }
    }

    if (this._cache.size >= this._maxCache) {
      const firstKey = this._cache.keys().next().value
      this._cache.delete(firstKey)
    }
    this._cache.set(event.id, classes)
    return classes
  }

  getTokenRules() {
    return this._rules.filter(r => r.type === 'token')
  }

  invalidate(eventId) {
    if (eventId) this._cache.delete(eventId)
    else this._cache.clear()
  }
}
