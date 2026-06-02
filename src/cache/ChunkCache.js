/**
 * ChunkCache — IndexedDB 기반 chunk 캐시 (보조 역할).
 *
 * 용도:
 *   - 이미 받은 서버 페이지 재요청 방지
 *   - 필터/정렬 결과 snapshot 임시 저장
 *   - 오프라인 fallback
 *
 * 핵심 엔진이 아니므로 실패해도 동작에 영향 없음.
 */
export class ChunkCache {
  constructor(options = {}) {
    this._dbName    = options.dbName    || 'trace-scope-cache'
    this._storeName = options.storeName || 'chunks'
    this._version   = options.version   || 1
    this._defaultTtl = options.ttl      || 5 * 60 * 1000  // 5 minutes
    this._db        = null
    this._ready     = null  // Promise
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async get(key) {
    try {
      await this._ensureReady()
      const record = await this._idbGet(key)
      if (!record) return null
      if (Date.now() > record.expiresAt) {
        this._idbDelete(key)
        return null
      }
      return record.value
    } catch {
      return null
    }
  }

  async set(key, value, ttl) {
    try {
      await this._ensureReady()
      const expiresAt = Date.now() + (ttl ?? this._defaultTtl)
      await this._idbPut({ key, value, expiresAt })
    } catch {
      // Cache failures are non-fatal
    }
  }

  async has(key) {
    return (await this.get(key)) !== null
  }

  async delete(key) {
    try {
      await this._ensureReady()
      await this._idbDelete(key)
    } catch {}
  }

  async clear() {
    try {
      await this._ensureReady()
      await this._idbClear()
    } catch {}
  }

  // Evict all expired entries
  async evictExpired() {
    try {
      await this._ensureReady()
      const now = Date.now()
      const keys = await this._idbGetAllKeys()
      for (const key of keys) {
        const record = await this._idbGet(key)
        if (record && now > record.expiresAt) await this._idbDelete(key)
      }
    } catch {}
  }

  destroy() {
    this._db?.close()
    this._db = null
  }

  // ── IndexedDB helpers ───────────────────────────────────────────────────────

  _ensureReady() {
    if (this._ready) return this._ready
    this._ready = this._open()
    return this._ready
  }

  _open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'))
        return
      }
      const req = indexedDB.open(this._dbName, this._version)

      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(this._storeName)) {
          db.createObjectStore(this._storeName, { keyPath: 'key' })
        }
      }

      req.onsuccess = (e) => {
        this._db = e.target.result
        resolve()
      }

      req.onerror = (e) => {
        reject(e.target.error)
      }
    })
  }

  _idbGet(key) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(this._storeName, 'readonly')
      const req = tx.objectStore(this._storeName).get(key)
      req.onsuccess = e => resolve(e.target.result || null)
      req.onerror   = e => reject(e.target.error)
    })
  }

  _idbPut(record) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(this._storeName, 'readwrite')
      const req = tx.objectStore(this._storeName).put(record)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  }

  _idbDelete(key) {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(this._storeName, 'readwrite')
      const req = tx.objectStore(this._storeName).delete(key)
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  }

  _idbClear() {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(this._storeName, 'readwrite')
      const req = tx.objectStore(this._storeName).clear()
      req.onsuccess = () => resolve()
      req.onerror   = e => reject(e.target.error)
    })
  }

  _idbGetAllKeys() {
    return new Promise((resolve, reject) => {
      const tx  = this._db.transaction(this._storeName, 'readonly')
      const req = tx.objectStore(this._storeName).getAllKeys()
      req.onsuccess = e => resolve(e.target.result || [])
      req.onerror   = e => reject(e.target.error)
    })
  }
}

/**
 * CachedServerRangeAdapter — ServerRangeAdapter + ChunkCache 통합 래퍼.
 * 동일 range 재요청 시 IndexedDB에서 반환, 서버 요청 생략.
 */
export class CachedServerRangeAdapter {
  constructor(serverAdapter, cacheOptions = {}) {
    this._server = serverAdapter
    this._cache  = new ChunkCache({
      dbName:  cacheOptions.dbName || 'trace-scope-server-cache',
      ttl:     cacheOptions.ttl   || 2 * 60 * 1000,  // 2 minutes
    })
  }

  async getRows(params) {
    const key = this._cacheKey(params)
    const cached = await this._cache.get(key)
    if (cached) return cached

    const result = await this._server.getRows(params)
    await this._cache.set(key, result)
    return result
  }

  _cacheKey({ start, end, sort, filter }) {
    return JSON.stringify({ start, end, sort, filter })
  }

  // Delegate everything else to server adapter
  getRowById(id)     { return this._server.getRowById(id) }
  getTotalCount()    { return this._server.getTotalCount() }
  applyFilter(f)     { this._server.applyFilter(f); this._cache.clear() }
  applySort(s)       { this._server.applySort(s);   this._cache.clear() }
  subscribe(cb)      { this._server.subscribe(cb) }
  unsubscribe()      { this._server.unsubscribe() }
  isServerSide()     { return true }

  destroy() {
    this._server.destroy?.()
    this._cache.destroy()
  }
}
