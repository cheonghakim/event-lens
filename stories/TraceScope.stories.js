import { TraceScope, ExportPlugin } from '../src/index.js'

TraceScope.use(ExportPlugin)

// Sample data generator
function makeEvents(count = 100) {
  const severities = ['critical', 'high', 'medium', 'low', 'info']
  const actions    = ['denied', 'allowed', 'dropped', 'blocked']
  const srcIps     = ['192.168.1.100', '10.0.0.55', '172.16.3.21']
  const rules      = ['SSH Brute Force', 'SQL Injection', 'Port Scan', 'Malware C2']

  return Array.from({ length: count }, (_, i) => {
    const sev = severities[i % severities.length]
    return {
      id:         `evt-${String(i + 1).padStart(5, '0')}`,
      timestamp:  new Date(Date.now() - i * 60000).toISOString(),
      severity:   sev,
      risk_score: sev === 'critical' ? 90 : sev === 'high' ? 70 : sev === 'medium' ? 45 : 20,
      src_ip:     srcIps[i % srcIps.length],
      dst_ip:     '10.0.0.1',
      action:     actions[i % actions.length],
      rule_name:  rules[i % rules.length],
      user:       `user_${i % 5}`,
      asset:      `server-${i % 3}`,
      raw_log:    `kernel: [FIREWALL] SRC=${srcIps[i % srcIps.length]} DST=10.0.0.1 RULE=${rules[i % rules.length]}`,
      parsed:     { bytes_in: 1024, bytes_out: 512, flags: 'SYN' },
      timeline:   [
        { id: 't1', type: 'detection', time: new Date().toISOString(), status: 'done', actor: 'SIEM', detail: 'Rule matched' },
        { id: 't2', type: 'alert',     time: new Date().toISOString(), status: 'done', actor: 'System', detail: 'Alert sent' },
      ],
    }
  })
}

export default {
  title:     'TraceScope / EventGrid',
  tags:      ['autodocs'],
  argTypes: {
    theme:   { control: 'select', options: ['dark', 'light'] },
    density: { control: 'select', options: ['compact', 'normal', 'comfortable'] },
    count:   { control: { type: 'range', min: 10, max: 10000, step: 10 } },
  },
}

// ── Stories ──────────────────────────────────────────────────────────────────

export const Default = {
  name: 'Default (Dark, 100 events)',
  args: { theme: 'dark', density: 'normal', count: 100 },
  render({ theme, density, count }) {
    const div = document.createElement('div')
    div.style.cssText = 'width:100%;height:100vh'

    const viewer = new TraceScope({
      container: div,
      dataSource: makeEvents(count),
      theme,
      density,
    })

    return div
  },
}

export const LightTheme = {
  name: 'Light Theme',
  args: { theme: 'light', density: 'normal', count: 100 },
  render: Default.render,
}

export const CompactDensity = {
  name: 'Compact Density',
  args: { theme: 'dark', density: 'compact', count: 200 },
  render: Default.render,
}

export const ComfortableDensity = {
  name: 'Comfortable Density',
  args: { theme: 'dark', density: 'comfortable', count: 50 },
  render: Default.render,
}

export const LargeDataset = {
  name: 'Large Dataset (5,000 events)',
  args: { theme: 'dark', density: 'compact', count: 5000 },
  render: Default.render,
}

export const WithGrouping = {
  name: 'With src_ip Grouping',
  args: { theme: 'dark', density: 'normal', count: 50 },
  render({ theme, density, count }) {
    const div = document.createElement('div')
    div.style.cssText = 'width:100%;height:100vh'

    new TraceScope({
      container: div,
      dataSource: makeEvents(count),
      theme,
      density,
      groupBy: 'src_ip',
    })

    return div
  },
}

export const WithHighlightRules = {
  name: 'With Highlight Rules',
  args: { theme: 'dark', density: 'normal', count: 100 },
  render({ theme, density, count }) {
    const div = document.createElement('div')
    div.style.cssText = 'width:100%;height:100vh'

    new TraceScope({
      container: div,
      dataSource: makeEvents(count),
      theme,
      density,
      highlightRules: [
        {
          priority: 100,
          when: e => e.severity === 'critical',
          className: 'ts-row--highlight-critical',
        },
      ],
    })

    return div
  },
}
