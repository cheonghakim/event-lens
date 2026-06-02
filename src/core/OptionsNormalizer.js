export const DEFAULT_COLUMNS = [
  { id: 'severity',   field: 'severity',   label: 'Severity', width: 90,  sortable: true },
  { id: 'timestamp',  field: 'timestamp',  label: 'Time',     width: 148, sortable: true },
  { id: 'src_ip',     field: 'src_ip',     label: 'Src IP',   width: 130, sortable: true },
  { id: 'dst_ip',     field: 'dst_ip',     label: 'Dst IP',   width: 130, sortable: true },
  { id: 'action',     field: 'action',     label: 'Action',   width: 80,  sortable: true },
  { id: 'rule_name',  field: 'rule_name',  label: 'Rule',     width: 200, sortable: false },
  { id: 'user',       field: 'user',       label: 'User',     width: 110, sortable: true },
  { id: 'asset',      field: 'asset',      label: 'Asset',    width: 120, sortable: true },
]

export function normalizeOptions(opts) {
  if (!opts.container) throw new Error('[TraceScope] container is required')
  if (opts.dataSource === undefined || opts.dataSource === null) {
    throw new Error('[TraceScope] dataSource is required')
  }

  return {
    container:      opts.container,
    dataSource:     opts.dataSource,
    columns:        normalizeColumns(opts.columns),
    theme:          opts.theme  || 'dark',
    density:        opts.density || 'normal',
    live:           normalizeLive(opts.live),
    virtualScroll:  normalizeVirtualScroll(opts.virtualScroll),
    detail:         normalizeDetail(opts.detail),
    highlightRules: opts.highlightRules || [],
    actions:        opts.actions        || [],
    plugins:        opts.plugins        || [],
    locale:         opts.locale         || 'ko-KR',
    worker:         normalizeWorker(opts.worker),
    renderMode:     opts.renderMode     || 'dom',    // 'dom' | 'canvas'
    groupBy:        opts.groupBy        || null,      // field name to group by
    storageKey:     opts.storageKey     ?? 'trace-scope-state',  // false to disable
  }
}

function normalizeColumns(cols) {
  if (!cols || cols.length === 0) return DEFAULT_COLUMNS
  return cols.map(c => ({
    id:        c.id        || c.field,
    field:     c.field,
    label:     c.label     || c.field,
    width:     c.width     || 120,
    minWidth:  c.minWidth  || 60,
    sortable:  c.sortable  !== false,
    resizable: c.resizable !== false,
    visible:   c.visible   !== false,
    renderer:  c.renderer  || null,
  }))
}

function normalizeLive(live) {
  if (!live || live === false) return { enabled: false }
  if (live === true) live = {}
  return {
    enabled:          true,
    mode:             live.mode             || 'append',
    maxBufferSize:    live.maxBufferSize     || 5000,
    flushInterval:    live.flushInterval     || 200,
    autoScroll:       live.autoScroll        || 'when-at-end',
    showNewEventBadge:live.showNewEventBadge !== false,
    pauseOnUserScroll:live.pauseOnUserScroll !== false,
    maxTotalRows:     live.maxTotalRows      || 100000,
    evictPolicy:      live.evictPolicy       || 'oldest-first',
  }
}

function normalizeVirtualScroll(vs) {
  if (vs === false) return { enabled: false, rowHeight: 32, overscan: 5, dynamicHeight: false }
  if (!vs || vs === true) vs = {}
  return {
    enabled:       true,
    rowHeight:     vs.rowHeight     || 32,
    overscan:      vs.overscan      || 5,
    dynamicHeight: vs.dynamicHeight || false,
  }
}

function normalizeWorker(worker) {
  if (!worker || worker === false) return { enabled: false }
  if (worker === true) return { enabled: true }
  return {
    enabled:    worker.enabled !== false,
    maxRows:    worker.maxRows || 100000,
  }
}

function normalizeDetail(detail) {
  if (!detail && detail !== true) return {
    enabled: true,
    layout:     'right',
    width:      480,
    height:     300,
    tabs:       ['parsedFields', 'rawLog', 'timeline'],
    defaultTab: 'parsedFields',
  }
  if (detail === false) return { enabled: false }
  if (detail === true) detail = {}
  return {
    enabled:    true,
    layout:     detail.layout     || 'right',
    width:      detail.width      || 480,
    height:     detail.height     || 300,
    tabs:       detail.tabs       || ['parsedFields', 'rawLog', 'timeline'],
    defaultTab: detail.defaultTab || 'parsedFields',
  }
}
