/**
 * MitrePlugin — ATT&CK technique 태깅
 *
 * 사용:
 *   import { MitrePlugin } from 'trace-scope'
 *   TraceScope.use(MitrePlugin.configure({
 *     // rule_id → technique(s) 매핑
 *     ruleMap: {
 *       'R1001': [{ id: 'T1078', name: 'Valid Accounts', tactic: 'Initial Access' }],
 *       'R1002': [{ id: 'T1110', name: 'Brute Force',    tactic: 'Credential Access' }],
 *     },
 *     // 또는 동적 조회
 *     lookup: async (ruleId, event) => [{ id: 'T1059', name: 'Command Scripting', tactic: 'Execution' }],
 *   }))
 */

const TACTIC_COLORS = {
  'Initial Access':      '#e05252',
  'Execution':           '#d07832',
  'Persistence':         '#b89030',
  'Privilege Escalation':'#c068a0',
  'Defense Evasion':     '#6868c0',
  'Credential Access':   '#e05252',
  'Discovery':           '#4882c5',
  'Lateral Movement':    '#d07832',
  'Collection':          '#4a9e52',
  'Command and Control': '#c068a0',
  'Exfiltration':        '#e05252',
  'Impact':              '#e05252',
}

function techniqueTag(tech) {
  const el  = document.createElement('span')
  const col = TACTIC_COLORS[tech.tactic] || '#5c5c5c'
  el.className = 'ts-mitre-tag'
  el.style.borderColor = col
  el.style.color = col
  el.textContent = tech.id
  el.title = `${tech.id} — ${tech.name}\nTactic: ${tech.tactic || 'Unknown'}`
  return el
}

function createPlugin(options = {}) {
  const ruleMap  = options.ruleMap  || {}
  const lookupFn = options.lookup   || null
  const cacheMs  = options.cacheMs  || 10 * 60 * 1000

  const _cache = new Map()

  async function getTechniques(event) {
    const key = event.rule_id || event.id
    if (!key) return []

    if (_cache.has(key)) return _cache.get(key)

    let techs = ruleMap[key] || []
    if (!techs.length && lookupFn) {
      try {
        techs = await lookupFn(key, event) || []
      } catch {
        techs = []
      }
    }
    _cache.set(key, techs)
    setTimeout(() => _cache.delete(key), cacheMs)
    return techs
  }

  return {
    name: 'mitre',
    install(ctx) {
      // Render ATT&CK tags in the rule_name column
      ctx.registerFieldRenderer('rule_name', (value, event) => {
        const wrap = document.createElement('span')
        wrap.className = 'ts-mitre-cell'

        const text = document.createElement('span')
        text.className = 'ts-cell-text'
        text.textContent = value || '-'
        wrap.appendChild(text)

        getTechniques(event).then(techs => {
          for (const tech of techs) {
            wrap.appendChild(techniqueTag(tech))
          }
        })

        return wrap
      })

      // Add MITRE section to parsed fields via column decorator
      ctx.registerColumnDecorator('rule_name', (cellEl, event) => {
        getTechniques(event).then(techs => {
          if (!techs.length) return
          cellEl.title = techs.map(t => `${t.id} ${t.name} (${t.tactic})`).join('\n')
        })
      })
    },
  }
}

const _default = createPlugin()
export const MitrePlugin = { ..._default, configure: createPlugin }
