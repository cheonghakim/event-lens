/**
 * ExportPlugin — 이벤트 내보내기 (CSV / JSON / JSONL)
 *
 * 사용:
 *   import { ExportPlugin } from 'trace-scope'
 *   TraceScope.use(ExportPlugin)
 */
export const ExportPlugin = {
  name: 'export',

  install(ctx) {
    ctx.registerAction('export-csv', {
      label:   'CSV 내보내기',
      handler: async (event, { viewer }) => {
        const rows = await _getExportRows(viewer, event)
        _downloadText(_toCSV(rows), `trace-scope-${_nowStr()}.csv`, 'text/csv;charset=utf-8')
      },
    })

    ctx.registerAction('export-json', {
      label:   'JSON 내보내기',
      handler: async (event, { viewer }) => {
        const rows = await _getExportRows(viewer, event)
        _downloadText(JSON.stringify(rows, null, 2), `trace-scope-${_nowStr()}.json`, 'application/json')
      },
    })

    ctx.registerAction('export-jsonl', {
      label:   'JSONL 내보내기',
      handler: async (event, { viewer }) => {
        const rows = await _getExportRows(viewer, event)
        const text = rows.map(r => JSON.stringify(r)).join('\n')
        _downloadText(text, `trace-scope-${_nowStr()}.jsonl`, 'application/x-ndjson')
      },
    })
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function _getExportRows(viewer, selectedEvent) {
  const ds    = viewer._dataSource
  const total = ds.getTotalCount?.() || 0
  if (total === 0) return [selectedEvent]

  // If totalCount is manageable (≤ 10k), export all filtered rows
  if (total <= 10000) {
    const { rows } = await ds.getRows({ start: 0, end: total - 1 })
    return rows || [selectedEvent]
  }

  // Otherwise export selected event + first 1000
  const { rows } = await ds.getRows({ start: 0, end: 999 })
  return rows || [selectedEvent]
}

function _toCSV(rows) {
  if (!rows.length) return ''

  const COLS = ['id', 'timestamp', 'severity', 'risk_score', 'src_ip', 'dst_ip',
                'action', 'rule_id', 'rule_name', 'user', 'asset', 'event_type']

  const header = COLS.join(',')
  const lines  = rows.map(r =>
    COLS.map(c => _csvCell(r[c])).join(',')
  )
  return [header, ...lines].join('\r\n')
}

function _csvCell(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (/[,"\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function _downloadText(text, filename, mime) {
  const blob = new Blob([text], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function _nowStr() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
}
