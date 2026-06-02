/**
 * Shared filter function builder.
 * Used by both FilterEngine (main thread) and DataWorker (Worker context).
 * Accepts a plain filter config object and returns a predicate function.
 */
export function buildFilterFn(filter) {
  if (!filter || Object.keys(filter).length === 0) return null

  const checks = []

  if (filter.severity?.length) {
    const set = new Set(filter.severity)
    checks.push(e => set.has(e.severity))
  }

  if (filter.riskScore) {
    const { min, max } = filter.riskScore
    if (min != null) checks.push(e => (e.risk_score ?? 0) >= min)
    if (max != null) checks.push(e => (e.risk_score ?? 0) <= max)
  }

  if (filter.timeRange) {
    const from = filter.timeRange.from ? new Date(filter.timeRange.from).getTime() : null
    const to   = filter.timeRange.to   ? new Date(filter.timeRange.to).getTime()   : null
    if (from != null) checks.push(e => new Date(e.timestamp).getTime() >= from)
    if (to   != null) checks.push(e => new Date(e.timestamp).getTime() <= to)
  }

  if (filter.srcIp?.length) {
    const set = new Set(filter.srcIp)
    checks.push(e => set.has(e.src_ip))
  }

  if (filter.dstIp?.length) {
    const set = new Set(filter.dstIp)
    checks.push(e => set.has(e.dst_ip))
  }

  if (filter.user?.length) {
    const set = new Set(filter.user)
    checks.push(e => set.has(e.user))
  }

  if (filter.asset?.length) {
    const set = new Set(filter.asset)
    checks.push(e => set.has(e.asset))
  }

  if (filter.action?.length) {
    const set = new Set(filter.action)
    checks.push(e => set.has(e.action))
  }

  if (filter.ruleId?.length) {
    const set = new Set(filter.ruleId)
    checks.push(e => set.has(e.rule_id))
  }

  if (filter.eventType?.length) {
    const set = new Set(filter.eventType)
    checks.push(e => set.has(e.event_type))
  }

  if (filter.rawLogContains) {
    const needle = filter.rawLogContains.toLowerCase()
    checks.push(e => (e.raw_log || '').toLowerCase().includes(needle))
  }

  if (filter.parsedField?.length) {
    for (const cond of filter.parsedField) {
      const { field, op, value } = cond
      switch (op) {
        case 'eq':
          checks.push(e => String(e[field] ?? e.parsed?.[field] ?? '') === String(value))
          break
        case 'neq':
          checks.push(e => String(e[field] ?? e.parsed?.[field] ?? '') !== String(value))
          break
        case 'contains': {
          const needle = String(value).toLowerCase()
          checks.push(e => String(e[field] ?? e.parsed?.[field] ?? '').toLowerCase().includes(needle))
          break
        }
        case 'gt':
          checks.push(e => Number(e[field] ?? e.parsed?.[field] ?? 0) > Number(value))
          break
        case 'lt':
          checks.push(e => Number(e[field] ?? e.parsed?.[field] ?? 0) < Number(value))
          break
        case 'regex': {
          const re = value instanceof RegExp ? value : new RegExp(value)
          checks.push(e => re.test(String(e[field] ?? e.parsed?.[field] ?? '')))
          break
        }
      }
    }
  }

  if (filter.quickSearch) {
    const q = filter.quickSearch.toLowerCase()
    checks.push(e =>
      (e.src_ip      || '').toLowerCase().includes(q) ||
      (e.dst_ip      || '').toLowerCase().includes(q) ||
      (e.user        || '').toLowerCase().includes(q) ||
      (e.rule_name   || '').toLowerCase().includes(q) ||
      (e.rule_id     || '').toLowerCase().includes(q) ||
      (e.asset       || '').toLowerCase().includes(q) ||
      (e.action      || '').toLowerCase().includes(q) ||
      (e.severity    || '').toLowerCase().includes(q) ||
      (e.event_type  || '').toLowerCase().includes(q) ||
      (e.session_id  || '').toLowerCase().includes(q) ||
      (e.raw_log     || '').toLowerCase().includes(q)
    )
  }

  if (checks.length === 0) return null
  return (event) => checks.every(fn => fn(event))
}

export function buildSortCompareFn(sort) {
  if (!sort?.field) return null
  const { field, direction } = sort
  return (a, b) => {
    const av = a[field], bv = b[field]
    if (av === bv) return 0
    const cmp = av < bv ? -1 : 1
    return direction === 'asc' ? cmp : -cmp
  }
}
