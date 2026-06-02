import { describe, it, expect, beforeEach } from 'vitest'
import { HeightCache }   from '../src/scroll/HeightCache.js'
import { PositionIndex } from '../src/scroll/PositionIndex.js'

describe('PositionIndex', () => {
  let cache, idx

  beforeEach(() => {
    cache = new HeightCache(32)
    cache.setCount(5)
    idx = new PositionIndex(cache)
  })

  it('getTotalHeight with uniform heights', () => {
    expect(idx.getTotalHeight()).toBe(160)  // 5 × 32
  })

  it('offsetForRow returns correct offsets', () => {
    expect(idx.offsetForRow(0)).toBe(0)
    expect(idx.offsetForRow(1)).toBe(32)
    expect(idx.offsetForRow(4)).toBe(128)
  })

  it('rowIndexAtOffset finds correct row', () => {
    expect(idx.rowIndexAtOffset(0)).toBe(0)
    expect(idx.rowIndexAtOffset(32)).toBe(1)
    expect(idx.rowIndexAtOffset(64)).toBe(2)
    expect(idx.rowIndexAtOffset(100)).toBe(3)
  })

  it('handles variable row heights', () => {
    cache.set(0, 100)  // row 0 is 100px tall
    idx.invalidate()
    expect(idx.getTotalHeight()).toBe(100 + 4 * 32)  // 228
    expect(idx.offsetForRow(1)).toBe(100)
    expect(idx.rowIndexAtOffset(50)).toBe(0)
    expect(idx.rowIndexAtOffset(110)).toBe(1)
  })

  it('rowIndexAtOffset clamps to last row', () => {
    expect(idx.rowIndexAtOffset(99999)).toBe(4)
  })

  it('rowIndexAtOffset clamps to 0 for negative', () => {
    expect(idx.rowIndexAtOffset(-10)).toBe(0)
  })
})
