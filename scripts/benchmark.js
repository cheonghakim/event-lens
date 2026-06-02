/**
 * TraceScope benchmark scenarios
 * Run: node scripts/benchmark.js
 *
 * Measures:
 *   1. buildFilterFn — filter 500k rows
 *   2. buildSortCompareFn — sort 100k rows
 *   3. GroupingEngine.build — group 50k rows
 *   4. PositionIndex.build + rowIndexAtOffset — 100k rows
 */
import { buildFilterFn, buildSortCompareFn } from '../src/filter/filterUtils.js'
import { GroupingEngine }                     from '../src/grid/GroupingEngine.js'
import { HeightCache }                        from '../src/scroll/HeightCache.js'
import { PositionIndex }                      from '../src/scroll/PositionIndex.js'

const SEV  = ['critical', 'high', 'medium', 'low', 'info']
const IPS  = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.1', '8.8.8.8']

function makeEvents(n) {
  return Array.from({ length: n }, (_, i) => ({
    id:         `evt-${i}`,
    timestamp:  new Date(Date.now() - i * 1000).toISOString(),
    severity:   SEV[i % SEV.length],
    risk_score: (i % 100),
    src_ip:     IPS[i % IPS.length],
    user:       `user_${i % 10}`,
    raw_log:    `log entry ${i} SRC=${IPS[i % IPS.length]}`,
  }))
}

function bench(label, fn, iterations = 1) {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  const elapsed = performance.now() - start
  const avg = elapsed / iterations
  const icon = avg < 50 ? '✅' : avg < 200 ? '⚠️' : '❌'
  console.log(`${icon}  ${label.padEnd(50)} ${avg.toFixed(1).padStart(7)}ms`)
}

console.log('\n══ TraceScope Benchmark ══════════════════════════════')
console.log(`  Node ${process.version}  ${new Date().toISOString()}\n`)

const events500k = makeEvents(500_000)
const events100k = makeEvents(100_000)
const events50k  = makeEvents(50_000)

// 1. Filter
const filterFn = buildFilterFn({ severity: ['critical', 'high'], srcIp: ['192.168.1.1'] })
bench('buildFilterFn on 500k rows (critical+high + srcIp)', () => {
  events500k.filter(filterFn)
})

// 2. quickSearch filter
const qsFn = buildFilterFn({ quickSearch: '192.168' })
bench('quickSearch filter on 100k rows', () => {
  events100k.filter(qsFn)
})

// 3. Sort
const sortFn = buildSortCompareFn({ field: 'risk_score', direction: 'desc' })
bench('buildSortCompareFn on 100k rows', () => {
  [...events100k].sort(sortFn)
})

// 4. Grouping
const ge = new GroupingEngine({ field: 'src_ip' })
bench('GroupingEngine.build on 50k rows', () => {
  ge.build(events50k)
})

// 5. PositionIndex
const cache = new HeightCache(32)
cache.setCount(100_000)
const posIdx = new PositionIndex(cache)
bench('PositionIndex.build (100k uniform rows)', () => {
  posIdx.invalidate()
  posIdx.build()
})

bench('PositionIndex.rowIndexAtOffset x1000', () => {
  for (let i = 0; i < 1000; i++) posIdx.rowIndexAtOffset(i * 3200)
})

console.log('\n══ Done ══════════════════════════════════════════════\n')
