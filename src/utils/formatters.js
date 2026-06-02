export function formatTimestamp(ts, locale = 'ko-KR') {
  if (!ts) return '-'
  try {
    const d = new Date(ts)
    return d.toLocaleString(locale, {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
  } catch {
    return String(ts)
  }
}

export function formatBytes(bytes) {
  if (bytes == null) return '-'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

export function formatRiskScore(score) {
  if (score == null) return '-'
  return String(Math.round(score))
}

export function severityLabel(severity) {
  const map = {
    critical: '위험',
    high: '높음',
    medium: '보통',
    low: '낮음',
    info: '정보',
    unknown: '알수없음'
  }
  return map[severity] || severity || '-'
}
