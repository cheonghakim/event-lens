/**
 * MaskingPlugin — 민감 정보 마스킹
 *
 * 사용:
 *   import { MaskingPlugin } from 'event-lens'
 *   EventLens.use(MaskingPlugin.configure({
 *     fields:  ['src_ip', 'user'],   // 마스킹할 필드명
 *     pattern: '***',                // 마스킹 문자열 (기본: '***')
 *     reveal:  false,                // 클릭으로 원문 보기 허용 여부
 *   }))
 *
 * 런타임 토글:
 *   viewer.emit('masking:toggle', { enabled: false })
 */

function maskValue(value, pattern) {
  if (value == null) return '-'
  const str = String(value)
  if (str.length <= 2) return pattern
  // Preserve first and last character for partial masking
  return str[0] + pattern + str[str.length - 1]
}

function createPlugin(options = {}) {
  const fields  = options.fields  || []
  const pattern = options.pattern || '***'
  const reveal  = options.reveal  ?? true

  let _enabled = true

  return {
    name: 'masking',
    install(ctx) {
      // Listen for runtime toggle
      ctx.on('masking:toggle', ({ enabled }) => {
        _enabled = (enabled !== false)
      })

      for (const field of fields) {
        ctx.registerFieldRenderer(field, (value) => {
          const wrap = document.createElement('span')
          wrap.className = 'el-cell-text el-masking-cell'

          const displayVal = _enabled ? maskValue(value, pattern) : (value ?? '-')
          wrap.textContent = displayVal

          if (reveal && _enabled) {
            wrap.title = 'Click to reveal'
            wrap.style.cursor = 'pointer'
            wrap.addEventListener('click', (e) => {
              e.stopPropagation()
              if (wrap.dataset.revealed === '1') {
                wrap.textContent = maskValue(value, pattern)
                wrap.title = 'Click to reveal'
                delete wrap.dataset.revealed
              } else {
                wrap.textContent = value ?? '-'
                wrap.title = 'Click to mask'
                wrap.dataset.revealed = '1'
              }
            })
          }

          return wrap
        })
      }
    },
  }
}

const _default = createPlugin()
export const MaskingPlugin = { ..._default, configure: createPlugin }
