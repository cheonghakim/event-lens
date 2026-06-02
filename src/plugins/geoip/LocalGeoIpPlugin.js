/**
 * LocalGeoIpPlugin — 외부 API 없이 프론트엔드에서 IP→국가/도시 표시.
 *
 * 사용 방법 (3가지):
 *
 * ① GeoLite2 JSON 파일 URL (권장)
 *    - scripts/build-geoip-db.js 로 GeoLite2-Country CSV → JSON 변환
 *    - 파일을 static 서버에 올리고 dbUrl 지정
 *
 *   import { LocalGeoIpPlugin } from 'event-lens'
 *   EventLens.use(LocalGeoIpPlugin.configure({
 *     dbUrl: '/static/geoip.json',   // 또는 import.meta.resolve('./geoip.json')
 *   }))
 *
 * ② 인라인 번들 (소규모)
 *   import geoipData from './geoip.json' assert { type: 'json' }
 *   EventLens.use(LocalGeoIpPlugin.configure({ db: geoipData }))
 *
 * ③ 커스텀 조회 함수
 *   EventLens.use(LocalGeoIpPlugin.configure({
 *     lookup: (ip) => ({ countryCode: 'KR', country: 'Korea', city: 'Seoul' })
 *   }))
 */

import { LocalGeoIpLookup } from './LocalGeoIpLookup.js'

// Precomputed flag emoji: A=0x1F1E6
function flagEmoji(cc) {
  if (!cc || cc.length !== 2) return ''
  try {
    return String.fromCodePoint(
      0x1F1E6 + cc.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + cc.toUpperCase().charCodeAt(1) - 65,
    )
  } catch { return '' }
}

function createPlugin(options = {}) {
  const ipFields    = options.ipFields    || ['src_ip', 'dst_ip']
  const showCity    = options.showCity    !== false
  const showCountry = options.showCountry !== false
  const lookup      = new LocalGeoIpLookup({
    dbUrl:  options.dbUrl  || null,
    db:     options.db     || null,
    lookup: options.lookup || null,
  })

  function renderCell(ip) {
    const wrap = document.createElement('span')
    wrap.className   = 'el-cell-text el-geoip-cell'
    wrap.textContent = ip || '-'
    wrap.title       = ip || ''

    if (ip) {
      lookup.lookup(ip).then(geo => {
        if (!geo) return
        const flag    = flagEmoji(geo.countryCode)
        const parts   = [flag]
        if (showCity    && geo.city)    parts.push(geo.city)
        if (showCountry && geo.country) parts.push(geo.country)
        const label = parts.filter(Boolean).join(' ')

        wrap.title = `${ip}\n${label}`

        if (flag) {
          const badge = document.createElement('span')
          badge.className   = 'el-geoip-badge'
          badge.textContent = flag
          badge.title       = label
          badge.setAttribute('aria-label', geo.country || geo.countryCode)
          wrap.appendChild(badge)
        }
      })
    }

    return wrap
  }

  return {
    name: 'local-geoip',
    install(ctx) {
      for (const field of ipFields) {
        ctx.registerFieldRenderer(field, (value) => renderCell(String(value || '')))
      }
    },
  }
}

const _default = createPlugin()
export const LocalGeoIpPlugin = { ..._default, configure: createPlugin }
