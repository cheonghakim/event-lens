/**
 * SoarPlugin — SOAR Playbook 연동
 *
 * 사용:
 *   import { SoarPlugin } from 'event-lens'
 *   EventLens.use(SoarPlugin.configure({
 *     playbooks: [
 *       {
 *         id:          'auto-block-critical',
 *         label:       'Critical IP 자동 차단',
 *         auto:        true,          // live 이벤트 인입 시 자동 실행
 *         cooldown:    60_000,        // 동일 cooldownKey 60초 내 재실행 방지
 *         cooldownKey: (e) => e.src_ip, // 기본: src_ip → 없으면 event.id
 *         when:        (e) => e.severity === 'critical' && !!e.src_ip,
 *         endpoint:    '/api/soar/block-ip',
 *         method:      'POST',
 *         headers:     { Authorization: 'Bearer <token>' },
 *         payload:     (e) => ({ src_ip: e.src_ip, rule_id: e.rule_id }),
 *       },
 *       {
 *         id:      'manual-isolate',
 *         label:   '호스트 격리',
 *         auto:    false,             // 수동 버튼만
 *         when:    (e) => !!e.asset,
 *         endpoint: '/api/soar/isolate',
 *         payload:  (e) => ({ asset: e.asset, event_id: e.id }),
 *       },
 *     ],
 *     onSuccess: (playbook, event, response) => console.log('SOAR OK', response),
 *     onError:   (playbook, event, error)    => console.error('SOAR ERR', error),
 *   }))
 *
 * 버스 이벤트:
 *   soar:running  { playbook: id, event }
 *   soar:success  { playbook: id, event, response }
 *   soar:error    { playbook: id, event, error }
 *
 * auto: true 플레이북 동작:
 *   - live:new-events 버스에서 각 이벤트를 받아 when() 조건 확인
 *   - cooldown 기간 내 동일 키(src_ip 등) 재실행 방지
 *   - 동일 event.id + playbook 조합 중복 실행 방지
 *   - ActionBar 버튼도 유지 (수동 재실행 가능)
 */

const PROCESSED_MAX = 10_000  // 처리 이력 최대 크기

function createPlugin(options = {}) {
  const playbooks = options.playbooks || []
  const onSuccess = options.onSuccess || null
  const onError   = options.onError   || null

  // cooldown 추적: Map<playbookId, Map<cooldownKey, lastRunTimestamp>>
  const _cooldowns = new Map()

  // 중복 실행 방지: Set<"playbookId:eventId">
  const _processed = new Set()

  function _getCooldownMap(playbookId) {
    if (!_cooldowns.has(playbookId)) _cooldowns.set(playbookId, new Map())
    return _cooldowns.get(playbookId)
  }

  function _cooldownKey(playbook, event) {
    if (playbook.cooldownKey) return playbook.cooldownKey(event)
    return event.src_ip || event.id
  }

  function _isOnCooldown(playbook, event) {
    if (!playbook.cooldown) return false
    const last = _getCooldownMap(playbook.id).get(_cooldownKey(playbook, event))
    return !!last && Date.now() - last < playbook.cooldown
  }

  function _markCooldown(playbook, event) {
    _getCooldownMap(playbook.id).set(_cooldownKey(playbook, event), Date.now())
  }

  function _markProcessed(playbook, event) {
    if (_processed.size >= PROCESSED_MAX) _processed.clear()
    _processed.add(`${playbook.id}:${event.id}`)
  }

  function _isProcessed(playbook, event) {
    return _processed.has(`${playbook.id}:${event.id}`)
  }

  async function _run(playbook, event, ctx) {
    const body = playbook.payload ? playbook.payload(event) : { event_id: event.id }

    ctx.emit('soar:running', { playbook: playbook.id, event })

    try {
      const res = await fetch(playbook.endpoint, {
        method:  playbook.method || 'POST',
        headers: { 'Content-Type': 'application/json', ...(playbook.headers || {}) },
        body:    JSON.stringify(body),
      })

      const data = res.ok ? await res.json().catch(() => null) : null

      if (!res.ok) {
        const err = new Error(`SOAR API returned HTTP ${res.status}`)
        onError?.(playbook, event, err)
        ctx.emit('soar:error', { playbook: playbook.id, event, error: err })
        return
      }

      onSuccess?.(playbook, event, data)
      ctx.emit('soar:success', { playbook: playbook.id, event, response: data })
    } catch (err) {
      onError?.(playbook, event, err)
      ctx.emit('soar:error', { playbook: playbook.id, event, error: err })
    }
  }

  // 행 상태 관리: Map<eventId, 'running'|'done'|'error'>
  const _rowStatuses = new Map()

  const STATUS_LABEL = { running: 'SOAR 처리 중', done: 'SOAR 완료', error: 'SOAR 오류' }
  const STATUS_ICON  = { running: '◌',            done: '✓',          error: '✗'        }

  function _applyToRow(rowEl, eventId) {
    rowEl.querySelector('.el-soar-badge')?.remove()
    const status = _rowStatuses.get(eventId)
    rowEl.dataset.soarStatus = status || ''
    if (!status) return

    const badge = document.createElement('span')
    badge.className = `el-soar-badge el-soar-badge--${status}`
    badge.title = STATUS_LABEL[status]
    badge.setAttribute('aria-label', STATUS_LABEL[status])
    badge.textContent = `${STATUS_ICON[status]} ${STATUS_LABEL[status]}`
    rowEl.appendChild(badge)
  }

  function _updateVisibleRow(eventId) {
    const rowEl = document.querySelector(`.el-row[data-event-id="${CSS.escape(eventId)}"]`)
    if (rowEl) _applyToRow(rowEl, eventId)
  }

  return {
    name: 'soar',
    install(ctx) {
      // ── 행 상태 데코레이터 (스크롤 재렌더 시 상태 유지) ─────────────────────
      ctx.registerRowDecorator((rowEl, event) => _applyToRow(rowEl, event.id))

      // ── 버스 이벤트 → 즉시 가시 행 업데이트 ────────────────────────────────
      ctx.on('soar:running', ({ event }) => {
        _rowStatuses.set(event.id, 'running')
        _updateVisibleRow(event.id)
      })
      ctx.on('soar:success', ({ event }) => {
        _rowStatuses.set(event.id, 'done')
        _updateVisibleRow(event.id)
      })
      ctx.on('soar:error', ({ event }) => {
        _rowStatuses.set(event.id, 'error')
        _updateVisibleRow(event.id)
      })

      // ── 모든 플레이북: ActionBar 수동 버튼 등록 ─────────────────────────────
      for (const playbook of playbooks) {
        ctx.registerAction(`soar:${playbook.id}`, {
          label:    playbook.label,
          disabled: playbook.when ? (event) => !playbook.when(event) : false,
          handler:  (event) => _run(playbook, event, ctx),
        })
      }

      // ── auto: true 플레이북: live 이벤트 인입 시 자동 실행 ─────────────────
      const autoPlaybooks = playbooks.filter(p => p.auto)
      if (autoPlaybooks.length === 0) return

      ctx.on('live:new-events', ({ events }) => {
        for (const event of (events || [])) {
          for (const playbook of autoPlaybooks) {
            if (_isProcessed(playbook, event))   continue
            if (!playbook.when?.(event))          continue
            if (_isOnCooldown(playbook, event))   continue

            _markProcessed(playbook, event)
            _markCooldown(playbook, event)
            _run(playbook, event, ctx)
          }
        }
      })
    },
  }
}

const _default = createPlugin()
export const SoarPlugin = { ..._default, configure: createPlugin }
