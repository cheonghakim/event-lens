/**
 * LocalGeoIpLookup — 프론트엔드 전용 IP→국가/도시 이진 탐색 엔진.
 *
 * 데이터 소스 옵션:
 *   1. dbUrl    — GeoLite2 JSON 변환 파일 URL (fetch + 메모리 캐시)
 *   2. db       — 이미 로드된 { ranges } 객체 (인라인 번들)
 *   3. lookup   — 커스텀 함수 (ip: string) => { countryCode, country, city, lat, lon }
 *
 * GeoLite2 JSON 형식 (scripts/build-geoip-db.js 로 생성):
 *   {
 *     "ranges": [[startIpNum, endIpNum, "KR", "South Korea", "Seoul", 37.5665, 126.978], ...]
 *   }
 *   columns: [0]=start [1]=end [2]=cc [3]=country [4]=city [5]=lat [6]=lon
 */
export class LocalGeoIpLookup {
  constructor(options = {}) {
    this._dbUrl      = options.dbUrl   || null
    this._db         = options.db      || null   // pre-loaded { ranges }
    this._customFn   = options.lookup  || null
    this._cache      = new Map()
    this._loading    = null
    this._ranges     = null             // Float64Array [start, end, ...] + metadata index
    this._meta       = null             // Parallel array: [{ cc, country, city, lat, lon }]
  }

  /** Resolve lookup for a single IP. Returns null if not found. */
  async lookup(ip) {
    if (!ip || typeof ip !== 'string') return null

    // Normalize: strip port, check IPv4
    const cleanIp = ip.split(':')[0].trim()
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return null

    const cached = this._cache.get(cleanIp)
    if (cached !== undefined) return cached

    // Custom function path
    if (this._customFn) {
      const result = await Promise.resolve(this._customFn(cleanIp)).catch(() => null)
      this._cache.set(cleanIp, result)
      return result
    }

    // Ensure database is loaded
    await this._ensureLoaded()
    if (!this._ranges) { this._cache.set(cleanIp, null); return null }

    const num    = this._ipToNum(cleanIp)
    const result = this._binarySearch(num)
    this._cache.set(cleanIp, result)
    return result
  }

  clearCache() { this._cache.clear() }

  // ── Private ─────────────────────────────────────────────────────────────────

  async _ensureLoaded() {
    if (this._ranges) return  // already loaded
    if (this._loading) { await this._loading; return }

    this._loading = this._load()
    await this._loading
    this._loading = null
  }

  async _load() {
    let raw = this._db

    if (!raw && this._dbUrl) {
      try {
        const res = await fetch(this._dbUrl)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        raw = await res.json()
      } catch (e) {
        console.warn('[LocalGeoIpLookup] Failed to load database:', e.message)
        return
      }
    }

    if (!raw?.ranges?.length) return

    // Build parallel arrays: Float64Array for start/end (fast binary search)
    const n      = raw.ranges.length
    const starts = new Float64Array(n)
    const ends   = new Float64Array(n)
    const meta   = new Array(n)

    for (let i = 0; i < n; i++) {
      const r = raw.ranges[i]
      starts[i] = r[0]
      ends[i]   = r[1]
      meta[i]   = { countryCode: r[2], country: r[3] || r[2], city: r[4] || '', lat: r[5] || 0, lon: r[6] || 0 }
    }

    this._ranges = { starts, ends }
    this._meta   = meta
  }

  _binarySearch(ipNum) {
    const { starts, ends } = this._ranges
    let lo = 0, hi = starts.length - 1

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (ipNum < starts[mid])      hi = mid - 1
      else if (ipNum > ends[mid])   lo = mid + 1
      else                          return this._meta[mid]
    }

    return null
  }

  _ipToNum(ip) {
    return ip.split('.').reduce((acc, octet) => (acc * 256 + parseInt(octet, 10)) >>> 0, 0)
  }
}
