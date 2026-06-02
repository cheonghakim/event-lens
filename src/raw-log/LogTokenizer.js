const TOKEN_PATTERNS = [
  { type: 'ip',    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'ipv6',  pattern: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g },
  { type: 'url',   pattern: /https?:\/\/[^\s"'>]+/g },
  { type: 'hash',  pattern: /\b[0-9a-fA-F]{32,64}\b/g },
  { type: 'email', pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
  { type: 'port',  pattern: /\bport[= :](\d{1,5})\b|\bDPT=(\d{1,5})\b|\bSPT=(\d{1,5})\b/gi },
]

export class LogTokenizer {
  tokenize(rawLog) {
    if (!rawLog) return [{ type: 'text', value: '' }]

    // Build a map of all matches with positions
    const matches = []
    for (const { type, pattern } of TOKEN_PATTERNS) {
      pattern.lastIndex = 0
      let m
      while ((m = pattern.exec(rawLog)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length, type, value: m[0] })
      }
    }

    // Sort by start position, remove overlaps
    matches.sort((a, b) => a.start - b.start)
    const filtered = []
    let cursor = 0
    for (const m of matches) {
      if (m.start >= cursor) {
        filtered.push(m)
        cursor = m.end
      }
    }

    // Build token list
    const tokens = []
    let pos = 0
    for (const m of filtered) {
      if (m.start > pos) {
        tokens.push({ type: 'text', value: rawLog.slice(pos, m.start) })
      }
      tokens.push({ type: m.type, value: m.value })
      pos = m.end
    }
    if (pos < rawLog.length) {
      tokens.push({ type: 'text', value: rawLog.slice(pos) })
    }

    return tokens.length > 0 ? tokens : [{ type: 'text', value: rawLog }]
  }
}
