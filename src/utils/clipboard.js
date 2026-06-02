export async function copyToClipboard(text) {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  return ok
}

export function eventToText(event) {
  const lines = []
  lines.push(`[${event.severity?.toUpperCase() || 'UNKNOWN'}] ${event.timestamp || ''}`)
  if (event.rule_name) lines.push(`Rule: ${event.rule_name}`)
  if (event.src_ip) lines.push(`Src: ${event.src_ip}`)
  if (event.dst_ip) lines.push(`Dst: ${event.dst_ip}`)
  if (event.user) lines.push(`User: ${event.user}`)
  if (event.asset) lines.push(`Asset: ${event.asset}`)
  if (event.raw_log) lines.push(`\nRaw: ${event.raw_log}`)
  return lines.join('\n')
}

export function eventToJson(event) {
  return JSON.stringify(event, null, 2)
}
