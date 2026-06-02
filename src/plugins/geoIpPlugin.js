/**
 * GeoIpPlugin — src_ip / dst_ip → 국가·도시 표시
 *
 * 사용:
 *   import { GeoIpPlugin } from 'trace-scope'
 *   TraceScope.use(GeoIpPlugin)
 *
 *   // 커스텀 API 엔드포인트
 *   TraceScope.use(GeoIpPlugin.configure({ apiBase: 'https://my-geoip/json/' }))
 *
 * 기본 API: http://ip-api.com/json/{ip}?fields=country,city,countryCode
 * (무료, 상업 서버에서는 Pro 플랜 사용 또는 자체 GeoIP DB 권장)
 */

const COUNTRY_FLAGS = {}  // countryCode → emoji flag, generated lazily

function flagEmoji(cc) {
  if (!cc) return ''
  if (COUNTRY_FLAGS[cc]) return COUNTRY_FLAGS[cc]
  // Regional indicator symbols: A=0x1F1E6 … Z=0x1F1FF
  const base = 0x1F1E6
  const flag = String.fromCodePoint(
    base + cc.toUpperCase().charCodeAt(0) - 65,
    base + cc.toUpperCase().charCodeAt(1) - 65,
  )
  COUNTRY_FLAGS[cc] = flag
  return flag
}

function createPlugin(options = {}) {
  const apiBase     = options.apiBase     || 'http://ip-api.com/json/'
  const apiParams   = options.apiParams   || 'fields=status,country,city,countryCode'
  const cacheMaxAge = options.cacheMaxAge || 10 * 60 * 1000  // 10 min
  const timeout     = options.timeout     || 4000
  const ipFields    = options.ipFields    || ['src_ip', 'dst_ip']

  const _cache = new Map()  // ip → { data, ts }

  async function lookup(ip) {
    if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return null

    const cached = _cache.get(ip)
    if (cached && Date.now() - cached.ts < cacheMaxAge) return cached.data

    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeout)
      const res = await fetch(`${apiBase}${encodeURIComponent(ip)}?${apiParams}`, {
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) return null
      const data = await res.json()
      if (data.status === 'fail') return null
      _cache.set(ip, { data, ts: Date.now() })
      return data
    } catch {
      return null
    }
  }

  function renderCell(ip) {
    const wrap = document.createElement('span')
    wrap.className = 'ts-cell-text ts-geoip-cell'
    wrap.textContent = ip || '-'
    wrap.title = ip || ''

    if (ip) {
      lookup(ip).then(geo => {
        if (!geo) return
        const flag  = flagEmoji(geo.countryCode)
        const label = [flag, geo.city, geo.country].filter(Boolean).join(' · ')
        wrap.title = `${ip}\n${label}`
        // Append subtle geo badge
        const badge = document.createElement('span')
        badge.className = 'ts-geoip-badge'
        badge.textContent = flag || geo.countryCode || ''
        badge.title = label
        wrap.appendChild(badge)
      })
    }

    return wrap
  }

  return {
    name: 'geoip',
    install(ctx) {
      for (const field of ipFields) {
        ctx.registerFieldRenderer(field, (value) => renderCell(value))
      }
    },
  }
}

export const GeoIpPlugin = createPlugin()
GeoIpPlugin.configure = (options) => createPlugin(options)
