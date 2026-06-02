/**
 * GeoLite2 CSV → EventLens GeoIP JSON 변환 스크립트
 *
 * 사전 준비:
 *   1. https://www.maxmind.com/en/geolite2/signup 에서 무료 계정 생성
 *   2. GeoLite2-Country-CSV 다운로드 및 압축 해제
 *   3. node scripts/build-geoip-db.js \
 *        --blocks  ./GeoLite2-Country-Blocks-IPv4.csv \
 *        --locs    ./GeoLite2-Country-Locations-en.csv \
 *        --output  ./public/geoip.json
 *
 * 출력 파일 형식:
 *   {
 *     "version": "2026-06",
 *     "ranges": [
 *       [startNum, endNum, "KR", "South Korea", "Seoul", 37.566, 126.978],
 *       ...
 *     ]
 *   }
 *   columns: [0]=ipStart [1]=ipEnd [2]=countryCode [3]=countryName [4]=city [5]=lat [6]=lon
 *
 * 출력 파일 크기:
 *   - 국가 수준 (GeoLite2-Country): ~2MB uncompressed, ~400KB gzip
 *   - gzip_static 또는 brotli 압축 권장
 */

import { createReadStream, writeFileSync } from 'fs'
import { createInterface } from 'readline'
import { parseArgs } from 'util'

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    blocks:  { type: 'string' },
    locs:    { type: 'string' },
    output:  { type: 'string', default: './geoip.json' },
    minify:  { type: 'boolean', default: true },
  },
})

if (!args.blocks || !args.locs) {
  console.error('Usage: node build-geoip-db.js --blocks <IPv4.csv> --locs <Locations-en.csv> [--output geoip.json]')
  process.exit(1)
}

// ── 1. Load location table: geoname_id → { countryCode, countryName, city } ──

async function loadLocations(file) {
  const map = new Map()
  const rl  = createInterface({ input: createReadStream(file), crlfDelay: Infinity })
  let first = true

  for await (const line of rl) {
    if (first) { first = false; continue }  // skip header
    const cols = line.split(',')
    // GeoLite2 Locations CSV: geoname_id, locale_code, continent_code, continent_name,
    //   country_iso_code, country_name, subdivision_1_iso_code, subdivision_1_name,
    //   subdivision_2_iso_code, subdivision_2_name, city_name, metro_code, time_zone, is_in_european_union
    const geonameId  = cols[0]
    const countryCode = cols[4]?.replace(/"/g, '') || ''
    const countryName = cols[5]?.replace(/"/g, '') || ''
    const city        = cols[10]?.replace(/"/g, '') || ''
    if (geonameId && countryCode) {
      map.set(geonameId, { countryCode, countryName, city })
    }
  }

  return map
}

// ── 2. Load IP blocks and build ranges ────────────────────────────────────────

function cidrToRange(cidr) {
  const [ip, prefixStr] = cidr.split('/')
  const prefix = parseInt(prefixStr, 10)
  const ipNum  = ip.split('.').reduce((acc, o) => (acc * 256 + parseInt(o, 10)) >>> 0, 0)
  const mask   = prefix === 0 ? 0 : ((0xFFFFFFFF << (32 - prefix)) >>> 0)
  const start  = (ipNum & mask) >>> 0
  const end    = (start | (~mask >>> 0)) >>> 0
  return [start, end]
}

async function buildRanges(blocksFile, locMap) {
  const ranges = []
  const rl = createInterface({ input: createReadStream(blocksFile), crlfDelay: Infinity })
  let first = true

  for await (const line of rl) {
    if (first) { first = false; continue }
    const cols = line.split(',')
    // Blocks CSV: network, geoname_id, registered_country_geoname_id, represented_country_geoname_id,
    //   is_anonymous_proxy, is_satellite_provider, is_anycast
    const cidr      = cols[0]
    const geonameId = cols[1] || cols[2]  // prefer geoname_id, fall back to registered_country

    if (!cidr || !geonameId) continue

    const loc = locMap.get(geonameId)
    if (!loc) continue

    const [start, end] = cidrToRange(cidr)
    // Compact representation: omit city if empty to save space
    if (loc.city) {
      ranges.push([start, end, loc.countryCode, loc.countryName, loc.city])
    } else {
      ranges.push([start, end, loc.countryCode, loc.countryName])
    }
  }

  // Sort by start IP for binary search
  ranges.sort((a, b) => a[0] - b[0])
  return ranges
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('Loading locations...')
const locMap = await loadLocations(args.locs)
console.log(`  Loaded ${locMap.size} locations`)

console.log('Building IP ranges...')
const ranges = await buildRanges(args.blocks, locMap)
console.log(`  Built ${ranges.length.toLocaleString()} IP ranges`)

const output = {
  version: new Date().toISOString().slice(0, 7),
  ranges,
}

const json = args.minify
  ? JSON.stringify(output)
  : JSON.stringify(output, null, 2)

writeFileSync(args.output, json, 'utf8')

const sizeKB = Math.round(Buffer.byteLength(json, 'utf8') / 1024)
console.log(`\nOutput: ${args.output} (${sizeKB} KB)`)
console.log('Tip: serve with gzip/brotli compression for best performance.')
