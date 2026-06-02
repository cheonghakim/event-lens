# EventLens

Enterprise security event viewer library for SOC, SIEM, and SOAR products.

SOC, SIEM, SOAR 제품을 위한 엔터프라이즈 보안 이벤트 뷰어 라이브러리입니다.

- Demo: https://cheonghakim.github.io/event-lens
- Package name: `event-lens`
- Runtime dependencies: none
- Build output: ESM, CommonJS, UMD, CSS
- Types: bundled in `types/index.d.ts`

## English

### What It Is

EventLens is a framework-agnostic JavaScript library for browsing, filtering, and investigating large security event datasets in the browser. It is designed for analyst workspaces where high-volume event grids, raw logs, parsed fields, related events, timelines, and live streams need to live in one compact UI.

### Feature Overview

| Category | Features |
|---|---|
| **Grid** | Virtual scroll (DOM + Canvas), row pooling, density-aware heights, column resize / reorder / visibility, row grouping (`groupBy`) |
| **Data** | Static array, async function, REST range adapter, WebSocket adapter, SSE adapter, IndexedDB chunk cache, Web Worker filter/sort |
| **Filtering** | Severity, time range, IP, user, field conditions (`eq/neq/contains/gt/lt/regex`), quick search, filter chips |
| **Detail panel** | Parsed fields, raw log (tokenized), event timeline, related events |
| **Live mode** | Append/prepend, buffer flush, auto-scroll, pause/resume, event badge, row eviction |
| **Plugins** | Export (CSV/JSON/JSONL), GeoIP, Threat Intel, MITRE ATT&CK, PII Masking, SOAR playbook |
| **Frameworks** | React, Vue 3, Svelte wrapper packages |
| **Quality** | Vitest unit tests (44), axe-core WCAG 2.1 AA Playwright audit, Storybook, benchmark suite |
| **Ops** | GitHub Actions CI + axe audit + Pages deploy + Changeset release |

### Installation

```bash
npm install event-lens
```

Import the library and CSS once:

```js
import { EventLens } from 'event-lens'
import 'event-lens/style'
```

Local development:

```bash
npm install
npm run dev
npm test
npm run build
npm run build:demo
```

### Quick Start

```html
<div id="viewer" style="height: 720px"></div>
```

```js
import { EventLens, ExportPlugin } from 'event-lens'
import 'event-lens/style'

EventLens.use(ExportPlugin)

const viewer = new EventLens({
  container: '#viewer',
  dataSource: [
    {
      id: 'evt-001',
      timestamp: '2026-06-02T09:00:00.000Z',
      severity: 'high',
      risk_score: 78,
      src_ip: '192.168.1.100',
      dst_ip: '10.0.0.10',
      action: 'denied',
      rule_id: 'R-1001',
      rule_name: 'Unauthorized SSH access',
      user: 'admin',
      asset: 'fw-edge-01',
      raw_log: 'SRC=192.168.1.100 DST=10.0.0.10 DPT=22 ACTION=denied',
      parsed: { protocol: 'TCP', dst_port: 22 },
      timeline: [
        { id: 't1', type: 'detection', status: 'done', actor: 'SIEM' },
        { id: 't2', type: 'investigation', status: 'pending' },
      ],
    },
  ],
  theme: 'dark',
  density: 'normal',
  worker: true,
  detail: {
    layout: 'right',
    width: 480,
    tabs: ['parsedFields', 'rawLog', 'timeline'],
    defaultTab: 'parsedFields',
  },
})

viewer.on('event:selected', ({ event }) => {
  console.log('Selected event:', event.id)
})
```

### Options

| Option | Type | Default | Description |
|---|---|---:|---|
| `container` | `string \| HTMLElement` | required | Container selector or element |
| `dataSource` | `array \| function \| adapter \| config` | required | Event source |
| `columns` | `EventColumn[]` | built-in SOC columns | Grid columns |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | Theme token set |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | Row density |
| `renderMode` | `'dom' \| 'canvas'` | `'dom'` | Rendering mode option |
| `groupBy` | `string \| null` | `null` | Group rows by a field such as `src_ip` |
| `live` | `boolean \| LiveOptions` | `false` | Live update behavior |
| `worker` | `boolean \| WorkerOptions` | `false` | Off-thread filtering and sorting |
| `virtualScroll` | `boolean \| VirtualScrollOptions` | enabled | Virtual scroll settings |
| `detail` | `boolean \| DetailOptions` | enabled | Detail panel settings |
| `highlightRules` | `HighlightRule[]` | `[]` | Row, cell, and token highlight rules |
| `actions` | `EventAction[]` | `[]` | Action buttons for selected events |
| `plugins` | `EventLensPlugin[]` | `[]` | Instance-level plugins |
| `locale` | `string` | `'ko-KR'` | Date/number locale |

### Columns

```js
columns: [
  {
    id: 'severity',
    field: 'severity',
    label: 'Severity',
    width: 90,
    minWidth: 60,
    sortable: true,
    resizable: true,
    visible: true,
    renderer: (value, event, column) => String(value),
  },
]
```

Default columns are `severity`, `timestamp`, `src_ip`, `dst_ip`, `action`, `rule_name`, `user`, and `asset`.

### Data Sources

Static array:

```js
new EventLens({
  container: '#viewer',
  dataSource: events,
})
```

Async function:

```js
new EventLens({
  container: '#viewer',
  dataSource: async ({ start, end, sort, filter, signal }) => {
    const limit = end - start + 1
    const res = await fetch(`/api/events?offset=${start}&limit=${limit}`, { signal })
    const json = await res.json()
    return { rows: json.events, totalCount: json.total }
  },
})
```

Server range REST adapter:

```js
import { ServerRangeAdapter } from 'event-lens'

const adapter = new ServerRangeAdapter({
  url: '/api/events',
  pageSize: 200,
  headers: { Authorization: 'Bearer <token>' },
  credentials: 'include',
  responseMapper: raw => ({
    rows: raw.data,
    totalCount: raw.meta.total,
  }),
})
```

WebSocket adapter:

```js
import { WebSocketAdapter } from 'event-lens'

const adapter = new WebSocketAdapter({
  url: 'wss://siem.example.com/events',
  reconnect: true,
  reconnectMs: 3000,
  messageMapper: raw => raw.type === 'events' ? raw.data : [raw.data],
})
```

SSE adapter:

```js
import { SSEAdapter } from 'event-lens'

const adapter = new SSEAdapter({
  url: '/api/events/stream',
  withCredentials: true,
  messageMapper: data => [JSON.parse(data)],
})
```

Config shorthand:

```js
dataSource: { type: 'server-range', url: '/api/events' }
dataSource: { type: 'websocket', url: 'wss://siem.example.com/events' }
dataSource: { type: 'sse', url: '/api/events/stream' }
```

### Filtering And Sorting

```js
viewer.applyFilter({
  severity: ['critical', 'high'],
  riskScore: { min: 70 },
  timeRange: {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-02T00:00:00.000Z',
  },
  srcIp: ['192.168.1.100'],
  user: ['admin'],
  rawLogContains: 'ssh',
  quickSearch: 'blocked',
})

viewer.setSort({ field: 'timestamp', direction: 'desc' })
viewer.clearFilter()
```

### Live Mode

```js
const viewer = new EventLens({
  container: '#viewer',
  dataSource: new WebSocketAdapter({ url: 'wss://siem.example.com/events' }),
  live: {
    enabled: true,
    mode: 'prepend',
    maxBufferSize: 5000,
    flushInterval: 200,
    autoScroll: 'when-at-end',
    showNewEventBadge: true,
    pauseOnUserScroll: true,
    maxTotalRows: 100000,
  },
})

viewer.pauseLive()
viewer.resumeLive()
viewer.isLivePaused()
```

### Web Worker Mode

```js
const viewer = new EventLens({
  container: '#viewer',
  dataSource: largeEventsArray,
  worker: { enabled: true, maxRows: 100000 },
})

console.log(viewer.isWorkerActive())
```

Worker mode is automatically skipped for server-side adapters.

### Detail Panel

```js
detail: {
  layout: 'right',
  width: 480,
  height: 300,
  tabs: ['parsedFields', 'rawLog', 'timeline'],
  defaultTab: 'parsedFields',
}
```

Supported event detail data:

```ts
interface SecurityEvent {
  id: string
  timestamp: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'
  risk_score?: number
  src_ip?: string
  dst_ip?: string
  user?: string
  asset?: string
  action?: string
  rule_id?: string
  rule_name?: string
  session_id?: string
  event_type?: string
  raw_log?: string
  parsed?: Record<string, unknown>
  timeline?: EventTimelineItem[]
  [key: string]: unknown
}
```

### Plugins

Built-in plugins exported from `event-lens`:

- `ExportPlugin`: CSV, JSON, JSONL downloads
- `GeoIpPlugin`: enrich IP fields with GeoIP lookup data
- `ThreatIntelPlugin`: enrich IP/hash indicators from a lookup API
- `MitrePlugin`: attach MITRE ATT&CK technique metadata
- `MaskingPlugin`: mask sensitive fields in raw logs/details
- `SoarPlugin`: call SOAR playbook APIs from actions

```js
import {
  EventLens,
  ExportPlugin,
  GeoIpPlugin,
  ThreatIntelPlugin,
  MitrePlugin,
  MaskingPlugin,
  SoarPlugin,
} from 'event-lens'

const viewer = new EventLens({
  container: '#viewer',
  dataSource: events,
  plugins: [
    ExportPlugin,
    GeoIpPlugin.configure({ apiBase: '/api/geoip/' }),
    ThreatIntelPlugin.configure({
      lookup: async (indicator, type) => {
        const res = await fetch(`/api/threat-intel?value=${indicator}&type=${type}`)
        return res.json()
      },
    }),
    MitrePlugin.configure({
      ruleMap: {
        'R-1001': [{ id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' }],
      },
    }),
    MaskingPlugin.configure({ fields: ['user', 'email'] }),
    SoarPlugin.configure({
      playbooks: [
        {
          id: 'block-ip',
          label: 'Block IP',
          endpoint: '/api/playbooks/block-ip',
          payload: event => ({ src_ip: event.src_ip, event_id: event.id }),
        },
      ],
    }),
  ],
})
```

Custom plugin:

```js
const MyPlugin = {
  name: 'my-plugin',
  install(ctx) {
    ctx.registerAction('block-ip', {
      label: 'Block IP',
      handler: async (event, { emit }) => {
        await fetch('/api/block-ip', {
          method: 'POST',
          body: JSON.stringify({ ip: event.src_ip }),
        })
        emit('ip:blocked', { ip: event.src_ip })
      },
    })
  },
}
```

### Public Methods

```ts
viewer.on(eventName, callback)
viewer.off(eventName, callback)
viewer.emit(eventName, payload)
viewer.use(plugin)
viewer.setDataSource(dataSource)
viewer.refresh()
viewer.scrollToRow(id)
viewer.scrollToIndex(index)
viewer.scrollToTop()
viewer.scrollToBottom()
viewer.selectEvent(id)
viewer.getSelectedEvent()
viewer.clearSelection()
viewer.applyFilter(filter)
viewer.clearFilter()
viewer.getFilter()
viewer.setSort(sort)
viewer.pauseLive()
viewer.resumeLive()
viewer.isLivePaused()
viewer.isWorkerActive()
viewer.destroy()
```

### Framework Wrappers

Vue 3:

```js
import { EventLensVue } from '@event-lens/vue'
```

React:

```jsx
import { EventLensReact } from '@event-lens/react'
```

Svelte:

```svelte
<script>
  import EventLensSvelte from '@event-lens/svelte'
</script>
```

### GitHub Pages Demo

The demo is built into `docs/` with:

```bash
npm run build:demo
```

`npm run build:demo` copies `index.html` and the built `dist/` files into `docs/`.
Run `npm run build` first when building the demo manually.

The Pages workflow deploys `docs/` to:

```text
https://cheonghakim.github.io/event-lens
```

### Enterprise Readiness Checklist

Ready:

- Dependency-light browser library
- Type declarations
- CI/build workflows
- Unit tests for core engines
- Multiple data-source integration patterns
- Worker fallback behavior
- IndexedDB cache fallback behavior
- Plugin-based extension points
- Demo deployment workflow

See [SECURITY.md](./SECURITY.md) for the full security and operational policy guide.

### Browser Support

| Browser | Minimum version |
|---|---|
| Chrome / Edge | 90+ |
| Firefox | 90+ |
| Safari | 15.4+ |
| Mobile Safari (iOS) | 15.4+ |
| Samsung Internet | 16+ |

Internet Explorer is not supported (ES modules, `import.meta.url`, optional chaining required).

### Performance SLOs

Measured with `npm run benchmark` on Intel Core i5 2.4 GHz:

| Scenario | Target | Achieved |
|---|---|---|
| Initial render — 5,000 rows | < 500ms | ~120ms |
| Filter apply — 100,000 rows (Worker) | < 100ms | ~13ms |
| Sort — 100,000 rows (Worker) | < 100ms | ~7ms |
| Scroll FPS (DOM backend) | ≥ 60 fps | ≥ 60 fps |
| Live throughput | 5,000 events/sec | sustained with 200ms flush |

### Accessibility

EventLens targets **WCAG 2.1 AA**. CI runs a full axe-core audit via Playwright against the live demo page on every push to `main`.

```bash
npm run a11y:install   # first-time Chromium setup
npm run a11y           # run full axe-core audit
```

---

## 한국어

### 개요

EventLens는 브라우저에서 대용량 보안 이벤트를 빠르게 조회, 필터링, 조사하기 위한 프레임워크 독립형 JavaScript 라이브러리입니다. SOC 분석가 화면, SIEM 대시보드, SOAR 운영 도구처럼 이벤트 그리드, 원문 로그, 파싱 필드, 관련 이벤트, 처리 타임라인, 실시간 스트림을 한 화면에 담아야 하는 제품에 맞춰져 있습니다.

### 기능 요약

| 분류 | 주요 기능 |
|---|---|
| **그리드** | 가상 스크롤(DOM·Canvas), 행 풀링, 밀도 전환, 컬럼 리사이즈·순서 변경·숨기기, 행 그룹핑(`groupBy`) |
| **데이터** | 정적 배열, 비동기 함수, REST·WebSocket·SSE 어댑터, IndexedDB 캐시, Web Worker 필터/정렬 |
| **필터** | severity, 시간 범위, IP, 사용자, 필드 조건(`eq/neq/contains/gt/lt/regex`), 빠른 검색, 필터 칩 |
| **상세 패널** | 파싱 필드, 원문 로그(토큰 하이라이트), 처리 타임라인, 연관 이벤트 |
| **라이브** | append/prepend, 버퍼 flush, 자동 스크롤, 일시정지/재개, 뱃지, 행 제거 정책 |
| **플러그인** | 내보내기(CSV·JSON·JSONL), GeoIP, 위협 인텔, MITRE ATT&CK, PII 마스킹, SOAR 플레이북 |
| **프레임워크** | React, Vue 3, Svelte 래퍼 패키지 |
| **품질** | Vitest 44개 테스트, axe-core WCAG 2.1 AA Playwright 감사, Storybook, 벤치마크 |
| **운영** | GitHub Actions CI + axe 감사 + Pages 배포 + Changeset 릴리스 |

운영 보안 정책(인증 토큰, CSP, PII, 내보내기 거버넌스)은 [SECURITY.md](./SECURITY.md)를 참고하세요.

### 브라우저 지원

| 브라우저 | 최소 버전 |
|---|---|
| Chrome / Edge | 90+ |
| Firefox | 90+ |
| Safari | 15.4+ |
| Mobile Safari (iOS) | 15.4+ |
| Samsung Internet | 16+ |

Internet Explorer는 지원하지 않습니다.

### 성능 SLO

`npm run benchmark` 기준 (Intel Core i5 2.4GHz):

| 시나리오 | 목표 | 실측 |
|---|---|---|
| 초기 렌더 — 5,000행 | < 500ms | ~120ms |
| 필터 — 100,000행 (Worker) | < 100ms | ~13ms |
| 정렬 — 100,000행 (Worker) | < 100ms | ~7ms |
| 스크롤 FPS (DOM) | ≥ 60 fps | ≥ 60 fps |

### 접근성

**WCAG 2.1 AA** 기준을 목표로 합니다. CI에서 `main` 브랜치 push마다 Playwright + axe-core 전체 감사가 실행됩니다.

```bash
npm run a11y:install   # 최초 1회 — Chromium 다운로드
npm run a11y           # axe-core 전체 감사 실행
```

### 설치

```bash
npm install event-lens
```

앱 엔트리에서 라이브러리와 CSS를 불러옵니다.

```js
import { EventLens } from 'event-lens'
import 'event-lens/style'
```

로컬 개발:

```bash
npm install
npm run dev
npm test
npm run build
npm run build:demo
```

### 빠른 시작

```html
<div id="viewer" style="height: 720px"></div>
```

```js
import { EventLens, ExportPlugin } from 'event-lens'
import 'event-lens/style'

EventLens.use(ExportPlugin)

const viewer = new EventLens({
  container: '#viewer',
  dataSource: events,
  theme: 'dark',
  density: 'normal',
  worker: true,
  detail: {
    layout: 'right',
    width: 480,
    tabs: ['parsedFields', 'rawLog', 'timeline'],
    defaultTab: 'parsedFields',
  },
})

viewer.on('event:selected', ({ event }) => {
  console.log('선택된 이벤트:', event.id)
})
```

### 주요 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---:|---|
| `container` | `string \| HTMLElement` | 필수 | 렌더링할 컨테이너 |
| `dataSource` | `array \| function \| adapter \| config` | 필수 | 이벤트 데이터소스 |
| `columns` | `EventColumn[]` | 기본 SOC 컬럼 | 그리드 컬럼 |
| `theme` | `'dark' \| 'light' \| 'auto'` | `'dark'` | 테마 |
| `density` | `'compact' \| 'normal' \| 'comfortable'` | `'normal'` | 행 밀도 |
| `renderMode` | `'dom' \| 'canvas'` | `'dom'` | 렌더링 모드 옵션 |
| `groupBy` | `string \| null` | `null` | 특정 필드 기준 그룹핑 |
| `live` | `boolean \| LiveOptions` | `false` | 실시간 이벤트 처리 |
| `worker` | `boolean \| WorkerOptions` | `false` | Worker 기반 필터/정렬 |
| `virtualScroll` | `boolean \| VirtualScrollOptions` | 활성 | 가상 스크롤 설정 |
| `detail` | `boolean \| DetailOptions` | 활성 | 상세 패널 설정 |
| `highlightRules` | `HighlightRule[]` | `[]` | 행/셀/토큰 하이라이트 |
| `actions` | `EventAction[]` | `[]` | 선택 이벤트 액션 버튼 |
| `plugins` | `EventLensPlugin[]` | `[]` | 인스턴스 플러그인 |
| `locale` | `string` | `'ko-KR'` | 날짜/숫자 로케일 |

### 데이터소스 사용법

정적 배열:

```js
new EventLens({ container: '#viewer', dataSource: events })
```

비동기 함수:

```js
new EventLens({
  container: '#viewer',
  dataSource: async ({ start, end, signal }) => {
    const limit = end - start + 1
    const res = await fetch(`/api/events?offset=${start}&limit=${limit}`, { signal })
    const json = await res.json()
    return { rows: json.events, totalCount: json.total }
  },
})
```

REST range:

```js
import { ServerRangeAdapter } from 'event-lens'

const adapter = new ServerRangeAdapter({
  url: '/api/events',
  pageSize: 200,
  headers: { Authorization: 'Bearer <token>' },
})
```

WebSocket:

```js
import { WebSocketAdapter } from 'event-lens'

const adapter = new WebSocketAdapter({
  url: 'wss://siem.example.com/events',
  reconnect: true,
})
```

SSE:

```js
import { SSEAdapter } from 'event-lens'

const adapter = new SSEAdapter({
  url: '/api/events/stream',
  withCredentials: true,
})
```

축약 설정:

```js
dataSource: { type: 'server-range', url: '/api/events' }
dataSource: { type: 'websocket', url: 'wss://siem.example.com/events' }
dataSource: { type: 'sse', url: '/api/events/stream' }
```

### 필터와 정렬

```js
viewer.applyFilter({
  severity: ['critical', 'high'],
  riskScore: { min: 70 },
  timeRange: {
    from: '2026-06-01T00:00:00.000Z',
    to: '2026-06-02T00:00:00.000Z',
  },
  srcIp: ['192.168.1.100'],
  rawLogContains: 'ssh',
  quickSearch: 'blocked',
})

viewer.setSort({ field: 'timestamp', direction: 'desc' })
viewer.clearFilter()
```

### 실시간 모드

```js
const viewer = new EventLens({
  container: '#viewer',
  dataSource: new WebSocketAdapter({ url: 'wss://siem.example.com/events' }),
  live: {
    enabled: true,
    mode: 'prepend',
    maxBufferSize: 5000,
    flushInterval: 200,
    autoScroll: 'when-at-end',
    showNewEventBadge: true,
    pauseOnUserScroll: true,
    maxTotalRows: 100000,
  },
})

viewer.pauseLive()
viewer.resumeLive()
viewer.isLivePaused()
```

### 플러그인

내장 플러그인:

- `ExportPlugin`: CSV, JSON, JSONL 다운로드
- `GeoIpPlugin`: IP 위치 정보 enrichment
- `ThreatIntelPlugin`: IP/hash threat intel enrichment
- `MitrePlugin`: MITRE ATT&CK technique 메타데이터 연결
- `MaskingPlugin`: 민감 정보 마스킹
- `SoarPlugin`: SOAR playbook API 호출

```js
import { EventLens, ExportPlugin, SoarPlugin } from 'event-lens'

const viewer = new EventLens({
  container: '#viewer',
  dataSource: events,
  plugins: [
    ExportPlugin,
    SoarPlugin.configure({
      playbooks: [
        {
          id: 'block-ip',
          label: 'Block IP',
          endpoint: '/api/playbooks/block-ip',
          payload: event => ({ src_ip: event.src_ip, event_id: event.id }),
        },
      ],
    }),
  ],
})
```

### 데모 배포

데모는 다음 명령으로 `docs/`에 빌드됩니다.

```bash
npm run build:demo
```

GitHub Pages 워크플로는 `docs/`를 배포하며, 공개 주소는 다음과 같습니다.

```text
https://cheonghakim.github.io/event-lens
```

### 엔터프라이즈 사용 전 체크리스트

준비된 항목:

- 타입 선언 포함
- 빌드/테스트 워크플로
- 핵심 엔진 단위 테스트
- REST/WebSocket/SSE/Worker/Cache 연동 구조
- 플러그인 확장 구조
- GitHub Pages 데모 배포 구조

운영 투입 전 추가로 정해야 할 항목:

- 인증 토큰 저장 방식
- CSP와 허용 API endpoint 정책
- 고객사별 PII 마스킹 기본값
- 실제 axe-core 접근성 감사
- export, 감사 로그, 데이터 보존 정책
- npm 배포 승인과 secret 관리
- 브라우저 지원 범위와 성능 SLO

## License

MIT. See [LICENSE](./LICENSE).
