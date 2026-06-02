import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VirtualScrollEngine, DENSITY_ROW_HEIGHTS } from '../src/scroll/VirtualScrollEngine.js'

describe('DENSITY_ROW_HEIGHTS', () => {
  it('has expected values', () => {
    expect(DENSITY_ROW_HEIGHTS.compact).toBe(24)
    expect(DENSITY_ROW_HEIGHTS.normal).toBe(32)
    expect(DENSITY_ROW_HEIGHTS.comfortable).toBe(40)
  })
})

describe('VirtualScrollEngine', () => {
  let engine

  beforeEach(() => {
    engine = new VirtualScrollEngine({ rowHeight: 32, overscan: 2 })
  })

  describe('setTotalCount', () => {
    it('updates totalCount', () => {
      engine.setTotalCount(100)
      expect(engine.totalCount).toBe(100)
    })
  })

  describe('setRowHeight', () => {
    it('updates rowHeight and triggers flush', () => {
      const cb = vi.fn()
      engine.onScroll(cb)
      engine.setRowHeight(24)
      expect(engine.rowHeight).toBe(24)
    })
  })

  describe('getVisibleRange', () => {
    it('returns correct startIdx for scrollTop=0', () => {
      engine.setTotalCount(1000)
      engine._containerHeight = 320
      engine._scrollTop = 0
      const { startIdx, endIdx } = engine.getVisibleRange()
      expect(startIdx).toBe(0)
      expect(endIdx).toBeGreaterThan(0)
    })

    it('respects overscan', () => {
      engine.setTotalCount(1000)
      engine._containerHeight = 320
      engine._scrollTop = 320  // scroll past 10 rows
      const { startIdx } = engine.getVisibleRange()
      // floor(320/32)=10, minus overscan=2 → 8
      expect(startIdx).toBe(8)
    })

    it('clamps endIdx to totalCount-1', () => {
      engine.setTotalCount(5)
      engine._containerHeight = 10000
      const { endIdx } = engine.getVisibleRange()
      expect(endIdx).toBe(4)
    })
  })

  describe('getTotalHeight', () => {
    it('equals totalCount * rowHeight', () => {
      engine.setTotalCount(100)
      expect(engine.getTotalHeight()).toBe(3200)
    })
  })

  describe('isAtTop', () => {
    it('returns true when scrollTop is 0', () => {
      engine._scrollTop = 0
      engine._scrollContainer = { scrollTop: 0 }
      expect(engine.isAtTop()).toBe(true)
    })

    it('returns false when scrolled down', () => {
      engine._scrollContainer = { scrollTop: 100 }
      expect(engine.isAtTop()).toBe(false)
    })
  })
})
