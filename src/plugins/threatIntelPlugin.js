/**
 * ThreatIntelPlugin — IP·해시 위협 평판 표시
 *
 * 사용:
 *   import { ThreatIntelPlugin } from 'trace-scope'
 *   TraceScope.use(ThreatIntelPlugin.configure({
 *     lookup: async (indicator, type) => {
 *       // type: 'ip' | 'hash'
 *       const res = await fetch(`/api/threat-intel?value=${indicator}&type=${type}`)
 *       const d = await res.json()
 *       // Return: { malicious: boolean, score: 0–100, tags: string[], source: string }
 *       return d
 *     }
 *   }))
 */

function createPlugin(options = {}) {
  const lookupFn   = options.lookup   || null
  const ipFields   = options.ipFields || ['src_ip', 'dst_ip']
  const hashFields = options.hashFields || []
  const cacheMs    = options.cacheMs  || 5 * 60 * 1000

  const _cache = new Map()

  async function lookup(value, type) {
    if (!value || !lookupFn) return null
    const key = `${type}:${value}`
    const hit = _cache.get(key)
    if (hit && Date.now() - hit.ts < cacheMs) return hit.data

    try {
      const data = await lookupFn(value, type)
      _cache.set(key, { data, ts: Date.now() })
      return data
    } catch {
      return null
    }
  }

  function renderIndicator(value, type) {
    const wrap = document.createElement('span')
    wrap.className = 'ts-cell-text ts-threat-cell'
    wrap.textContent = value || '-'

    if (value && lookupFn) {
      lookup(value, type).then(result => {
        if (!result) return
        const dot = document.createElement('span')
        dot.className = result.malicious
          ? 'ts-threat-dot ts-threat-dot--malicious'
          : 'ts-threat-dot ts-threat-dot--clean'
        const tags = result.tags?.join(', ') || ''
        dot.title = `Score: ${result.score ?? '?'} | ${tags || 'No tags'} | ${result.source || ''}`
        wrap.insertBefore(dot, wrap.firstChild)
        if (result.malicious) {
          wrap.classList.add('ts-threat-cell--malicious')
        }
      })
    }

    return wrap
  }

  return {
    name: 'threat-intel',
    install(ctx) {
      for (const field of ipFields) {
        ctx.registerFieldRenderer(field, (value) => renderIndicator(value, 'ip'))
      }
      for (const field of hashFields) {
        ctx.registerFieldRenderer(field, (value) => renderIndicator(value, 'hash'))
      }
    },
  }
}

const _defaultPlugin = createPlugin()
export const ThreatIntelPlugin = { ..._defaultPlugin, configure: createPlugin }
