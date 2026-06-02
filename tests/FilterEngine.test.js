import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildFilterFn, buildSortCompareFn } from '../src/filter/filterUtils.js'

const EVENTS = [
  { id: '1', severity: 'critical', src_ip: '192.168.1.1', user: 'admin',  risk_score: 90, timestamp: '2026-01-01T10:00:00Z', raw_log: 'SRC=192.168.1.1 DST=10.0.0.1' },
  { id: '2', severity: 'high',     src_ip: '10.0.0.55',   user: 'bob',    risk_score: 70, timestamp: '2026-01-01T09:00:00Z', raw_log: 'malware detected' },
  { id: '3', severity: 'low',      src_ip: '172.16.0.1',  user: 'alice',  risk_score: 20, timestamp: '2026-01-01T08:00:00Z', raw_log: 'allowed' },
  { id: '4', severity: 'info',     src_ip: '192.168.1.1', user: 'system', risk_score: 5,  timestamp: '2026-01-01T07:00:00Z', raw_log: 'info log' },
]

describe('buildFilterFn', () => {
  it('returns null (no-op) when filter is empty', () => {
    expect(buildFilterFn({})).toBeNull()
    expect(buildFilterFn(null)).toBeNull()
  })

  it('returns all rows when filter is empty (null means no filter)', () => {
    const fn = buildFilterFn({}) ?? (() => true)
    expect(EVENTS.filter(fn)).toHaveLength(4)
  })

  it('filters by severity array', () => {
    const fn = buildFilterFn({ severity: ['critical', 'high'] })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toEqual(['1', '2'])
  })

  it('filters by srcIp', () => {
    const fn = buildFilterFn({ srcIp: ['192.168.1.1'] })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toEqual(['1', '4'])
  })

  it('filters by riskScore range', () => {
    const fn = buildFilterFn({ riskScore: { min: 60, max: 100 } })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toEqual(['1', '2'])
  })

  it('filters by quickSearch (case-insensitive)', () => {
    const fn = buildFilterFn({ quickSearch: 'alice' })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toEqual(['3'])
  })

  it('filters by rawLogContains', () => {
    const fn = buildFilterFn({ rawLogContains: 'malware' })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toEqual(['2'])
  })

  it('filters by parsedField eq', () => {
    const fn = buildFilterFn({ parsedField: [{ field: 'user', op: 'eq', value: 'admin' }] }) ?? (() => true)
    expect(EVENTS.filter(fn).map(e => e.id)).toEqual(['1'])
  })

  it('filters by parsedField contains', () => {
    const fn = buildFilterFn({ parsedField: [{ field: 'user', op: 'contains', value: 'ali' }] }) ?? (() => true)
    expect(EVENTS.filter(fn).map(e => e.id)).toEqual(['3'])
  })

  it('filters by parsedField gt', () => {
    const fn = buildFilterFn({ parsedField: [{ field: 'risk_score', op: 'gt', value: 80 }] }) ?? (() => true)
    expect(EVENTS.filter(fn).map(e => e.id)).toEqual(['1'])
  })

  it('filters by timeRange', () => {
    const fn = buildFilterFn({ timeRange: { from: '2026-01-01T09:00:00Z', to: '2026-01-01T11:00:00Z' } })
    const result = EVENTS.filter(fn)
    expect(result.map(e => e.id)).toContain('1')
    expect(result.map(e => e.id)).toContain('2')
    expect(result.map(e => e.id)).not.toContain('3')
  })

  it('combines multiple filter conditions (AND logic)', () => {
    const fn = buildFilterFn({ severity: ['critical'], srcIp: ['192.168.1.1'] })
    expect(EVENTS.filter(fn).map(e => e.id)).toEqual(['1'])
  })
})

describe('buildSortCompareFn', () => {
  it('sorts by risk_score desc', () => {
    const cmp = buildSortCompareFn({ field: 'risk_score', direction: 'desc' })
    const sorted = [...EVENTS].sort(cmp)
    expect(sorted.map(e => e.id)).toEqual(['1', '2', '3', '4'])
  })

  it('sorts by risk_score asc', () => {
    const cmp = buildSortCompareFn({ field: 'risk_score', direction: 'asc' })
    const sorted = [...EVENTS].sort(cmp)
    expect(sorted.map(e => e.id)).toEqual(['4', '3', '2', '1'])
  })

  it('sorts by timestamp desc', () => {
    const cmp = buildSortCompareFn({ field: 'timestamp', direction: 'desc' })
    const sorted = [...EVENTS].sort(cmp)
    expect(sorted[0].id).toBe('1')  // latest first
  })
})
