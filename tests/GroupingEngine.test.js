import { describe, it, expect, beforeEach } from 'vitest'
import { GroupingEngine } from '../src/grid/GroupingEngine.js'

const EVENTS = [
  { id: '1', src_ip: '10.0.0.1', severity: 'critical' },
  { id: '2', src_ip: '10.0.0.1', severity: 'high' },
  { id: '3', src_ip: '192.168.1.1', severity: 'low' },
  { id: '4', src_ip: '172.16.0.1', severity: 'info' },
]

describe('GroupingEngine', () => {
  let ge

  beforeEach(() => {
    ge = new GroupingEngine({ field: 'src_ip' })
  })

  it('groups events by field', () => {
    const flat = ge.build(EVENTS)
    const groupItems = flat.filter(i => i.type === 'group')
    expect(groupItems).toHaveLength(3)
    const group10 = groupItems.find(g => g.key === '10.0.0.1')
    expect(group10.count).toBe(2)
  })

  it('interleaves group headers and rows', () => {
    const flat = ge.build(EVENTS)
    expect(flat[0].type).toBe('group')
    expect(flat[1].type).toBe('row')
  })

  it('collapses a group (hides children)', () => {
    ge.collapse('10.0.0.1')
    const flat = ge.build(EVENTS)
    const rowsFor10 = flat.filter(i => i.type === 'row' && i.groupKey === '10.0.0.1')
    expect(rowsFor10).toHaveLength(0)
  })

  it('expands a collapsed group', () => {
    ge.collapse('10.0.0.1')
    ge.expand('10.0.0.1')
    const flat = ge.build(EVENTS)
    const rowsFor10 = flat.filter(i => i.type === 'row' && i.groupKey === '10.0.0.1')
    expect(rowsFor10).toHaveLength(2)
  })

  it('toggle works as expected', () => {
    ge.toggle('10.0.0.1')
    expect(ge.isCollapsed('10.0.0.1')).toBe(true)
    ge.toggle('10.0.0.1')
    expect(ge.isCollapsed('10.0.0.1')).toBe(false)
  })

  it('collapseAll and expandAll work', () => {
    const keys = ['10.0.0.1', '192.168.1.1', '172.16.0.1']
    ge.collapseAll(keys)
    expect(keys.every(k => ge.isCollapsed(k))).toBe(true)
    ge.expandAll()
    expect(keys.some(k => ge.isCollapsed(k))).toBe(false)
  })

  it('setField clears collapsed state', () => {
    ge.collapse('10.0.0.1')
    ge.setField('severity')
    expect(ge.isCollapsed('10.0.0.1')).toBe(false)
    expect(ge.field).toBe('severity')
  })
})
