# TraceScope — Security & Operational Policy Guide

**보안 및 운영 정책 가이드** · [English](#english) · [한국어](#한국어)

---

## English

### Scope

This document covers security considerations for **teams embedding TraceScope in production SOC, SIEM, or SOAR products**. It addresses:

1. [Authentication and token handling](#1-authentication-and-token-handling)
2. [Content Security Policy](#2-content-security-policy)
3. [PII masking policy](#3-pii-masking-policy)
4. [Data retention and IndexedDB cache](#4-data-retention-and-indexeddb-cache)
5. [Export governance](#5-export-governance)
6. [Browser support matrix](#6-browser-support-matrix)
7. [Performance SLOs](#7-performance-slos)
8. [Vulnerability reporting](#8-vulnerability-reporting)

---

### 1. Authentication and Token Handling

#### Passing credentials to data source adapters

TraceScope itself does **not** store, manage, or transmit authentication tokens. Tokens are passed through the `headers` option of server-side adapters and forwarded via browser `fetch` or `WebSocket`.

```js
// REST: Authorization header per request
const adapter = new ServerRangeAdapter({
  url: "/api/events",
  headers: { Authorization: `Bearer ${getAccessToken()}` },
  credentials: "same-origin",
});

// WebSocket: token in query param or via first-message auth
const ws = new WebSocketAdapter({
  url: `wss://siem.example.com/events?token=${getAccessToken()}`,
});

// Rotate on session refresh — no TraceScope restart needed
viewer.setDataSource(
  new ServerRangeAdapter({
    url: "/api/events",
    headers: { Authorization: `Bearer ${newToken}` },
  }),
);
```

#### Token storage recommendations

| Storage location     | Risk                    | Recommendation                                                               |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `localStorage`       | XSS-exposed             | Avoid for long-lived tokens                                                  |
| `sessionStorage`     | Tab-scoped, XSS-exposed | Acceptable for session tokens                                                |
| `httpOnly` cookie    | XSS-resistant           | Preferred for auth cookies                                                   |
| Memory (JS variable) | Lost on reload          | Preferred for access tokens; combine with refresh-token in `httpOnly` cookie |

#### Token refresh

When the adapter receives an HTTP 401, invalidate the token and re-authenticate before calling `viewer.setDataSource()` with a new adapter instance containing the refreshed token.

```js
async function authenticatedAdapter() {
  const token = await getOrRefreshToken();
  return new ServerRangeAdapter({
    url: "/api/events",
    headers: { Authorization: `Bearer ${token}` },
    responseMapper: (raw) => ({ rows: raw.data, totalCount: raw.total }),
  });
}

viewer.setDataSource(await authenticatedAdapter());
```

---

### 2. Content Security Policy

TraceScope requires the following CSP directives when deployed on a strict CSP policy.

#### Minimum required directives

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self';
  style-src   'self' 'unsafe-inline';
  worker-src  'self' blob:;
  connect-src 'self' wss://siem.example.com https://siem.example.com;
  img-src     'self' data:;
  font-src    'self';
```

#### Directive explanation

| Directive                   | Why TraceScope needs it                                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `style-src 'unsafe-inline'` | CSS custom properties are applied via inline `style` attributes on rows and cells. Without this, density/theme changes that modify inline styles will be blocked.                                                                   |
| `worker-src 'self' blob:`   | `WorkerBridge` creates a module Worker via `new URL('./DataWorker.js', import.meta.url)`. The `blob:` source is needed when the worker is inlined by some bundlers. If using Vite's default chunking, `'self'` alone is sufficient. |
| `connect-src`               | Add your SIEM API hostname, WebSocket server (`wss://`), and any GeoIP or threat-intel API endpoints used by plugins.                                                                                                               |
| `img-src data:`             | Flag emoji in `GeoIpPlugin` uses `String.fromCodePoint` (text, not images), so `data:` is only needed if your app uses data URIs elsewhere.                                                                                         |

#### Canvas backend

`CanvasRenderBackend` requires no additional CSP directives. Canvas 2D rendering is allowed under default `script-src 'self'`.

#### Nonce-based CSP (recommended for strict environments)

If you can set a nonce on scripts, replace `'unsafe-inline'` in `style-src` with `'nonce-<value>'` and ensure your bundler injects the nonce into any generated `<style>` tags.

---

### 3. PII Masking Policy

TraceScope renders whatever data is passed in the `dataSource`. Your data pipeline is responsible for masking PII before it reaches the client. TraceScope's `MaskingPlugin` provides a **secondary display-layer mask** and should not be the sole PII control.

#### Recommended masking strategy

```
Data Pipeline (server) → Primary PII masking
      ↓
TraceScope MaskingPlugin  → Display-layer masking (secondary)
```

#### MaskingPlugin configuration for common deployments

**SOC Tier 1 (unauthenticated analysts)**

```js
import { MaskingPlugin } from "trace-scope";

TraceScope.use(
  MaskingPlugin.configure({
    fields: ["user", "src_ip", "dst_ip", "email", "session_id"],
    pattern: "***",
    reveal: false, // no reveal allowed — strictly masked
  }),
);
```

**SOC Tier 2/3 (senior analysts with data access)**

```js
TraceScope.use(
  MaskingPlugin.configure({
    fields: ["user", "email"],
    pattern: "***",
    reveal: true, // click-to-reveal allowed
  }),
);
```

**Toggle masking at runtime (role-based)**

```js
// After viewer is mounted and user role is resolved:
viewer.emit("masking:toggle", { enabled: userRole !== "senior-analyst" });
```

#### Raw log masking

`MaskingPlugin` masks structured fields in the parsed field table and cell renderers. Raw log text in the `rawLog` tab is **not** automatically masked. Either:

- Strip PII in the data pipeline before setting `event.raw_log`
- Override the raw log renderer via a custom plugin that applies regex substitution

---

### 4. Data Retention and IndexedDB Cache

#### IndexedDB cache (ChunkCache / CachedServerRangeAdapter)

The IndexedDB cache (`ChunkCache`) stores server response chunks locally in the browser. Each entry has a configurable TTL.

```js
import {
  CachedServerRangeAdapter,
  ServerRangeAdapter,
  ChunkCache,
} from "trace-scope";

const adapter = new CachedServerRangeAdapter(
  new ServerRangeAdapter({ url: "/api/events" }),
  {
    dbName: "trace-scope-events",
    ttl: 2 * 60 * 1000, // 2 minutes (default)
  },
);
```

**Cache eviction:**

| Scenario           | Behavior                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| TTL expiry         | Entry evicted on next read; no background sweep                                                 |
| Filter/sort change | Cache cleared automatically (`CachedServerRangeAdapter.applyFilter()` calls `cache.clear()`)    |
| Manual clear       | `cache.clear()` evicts all entries; `cache.evictExpired()` evicts stale entries                 |
| User logout        | Call `adapter.destroy()` or manually clear with `indexedDB.deleteDatabase('trace-scope-events')` |

**Recommendation:** Clear the IndexedDB database on user logout or session expiry.

#### Live event buffer

The `LiveController` retains events in the data source's in-memory array up to `maxTotalRows` (default 100,000). These are not persisted across page reloads. No browser storage is written by the live controller.

---

### 5. Export Governance

`ExportPlugin` allows downloading event data as CSV, JSON, or JSONL. The following controls apply.

#### Default behavior

| Scenario            | Rows exported                     |
| ------------------- | --------------------------------- |
| Total rows ≤ 10,000 | All currently filtered rows       |
| Total rows > 10,000 | First 1,000 rows + selected event |

#### Restricting export

To disable export entirely, do not register `ExportPlugin`. To restrict by role:

```js
import { ExportPlugin } from "trace-scope";

if (userHasPermission("export_events")) {
  TraceScope.use(ExportPlugin);
}
```

To audit export actions, listen to the `event:action` event:

```js
viewer.on("event:action", ({ actionId, event }) => {
  if (actionId.startsWith("export-")) {
    auditLog.record({
      action: actionId,
      user: currentUser.id,
      eventIds: [event.id],
      timestamp: new Date().toISOString(),
    });
  }
});
```

#### SOAR playbook export governance

`SoarPlugin` calls external SOAR API endpoints when an analyst triggers a playbook. Ensure:

- Endpoint URLs are validated server-side
- Playbook payloads do not include raw log data unless required
- API calls are logged in your SOAR platform's audit trail

---

### 6. Browser Support Matrix

TraceScope requires modern browsers. No polyfills are included.

| Browser             | Minimum version | Notes                                                     |
| ------------------- | --------------- | --------------------------------------------------------- |
| Chrome / Edge       | 90+             | Full support including Worker mode                        |
| Firefox             | 90+             | Full support                                              |
| Safari              | 15.4+           | Full support; `EventTarget` inheritance issues below 15.4 |
| Mobile Safari (iOS) | 15.4+           | Tested on iPhone 13+ viewport                             |
| Samsung Internet    | 16+             | Based on Chromium 96+                                     |

**Required browser APIs:**

| API                     | Used for                                                      |
| ----------------------- | ------------------------------------------------------------- |
| `ResizeObserver`        | Container size detection in `VirtualScrollEngine`             |
| `Web Workers`           | Optional `WorkerBridge`; falls back gracefully if unsupported |
| `IndexedDB`             | Optional `ChunkCache`; falls back gracefully if unsupported   |
| `Canvas 2D`             | Optional `CanvasRenderBackend`; DOM backend is the default    |
| `AbortController`       | Request cancellation in `ServerRangeAdapter`                  |
| `EventSource`           | `SSEAdapter` (Server-Sent Events)                             |
| `WebSocket`             | `WebSocketAdapter`                                            |
| `CSS Custom Properties` | Theme system; all supported browsers above support this       |

**Internet Explorer:** Not supported. TraceScope uses ES modules, `import.meta.url`, optional chaining, and nullish coalescing throughout.

---

### 7. Performance SLOs

These are reference targets measured on the included benchmark suite (`npm run benchmark`) with a mid-range laptop CPU (Intel Core i5, 2.4 GHz).

#### Render performance

| Scenario                                   | Target    | Achieved (benchmark) |
| ------------------------------------------ | --------- | -------------------- |
| Initial render — 5,000 rows                | < 500ms   | ~120ms               |
| Initial render — 50,000 rows (Worker mode) | < 1,000ms | ~300ms               |
| Filter apply — 100,000 rows in Worker      | < 100ms   | ~13ms                |
| Sort apply — 100,000 rows in Worker        | < 100ms   | ~7ms                 |
| GroupingEngine.build — 50,000 rows         | < 200ms   | ~5ms                 |
| Scroll FPS (DOM backend)                   | ≥ 60 fps  | ≥ 60 fps on Chrome   |

#### Live throughput

| Scenario                                | Target                                                          |
| --------------------------------------- | --------------------------------------------------------------- |
| Sustained live event rate               | up to 5,000 events/sec (buffered at 200ms flush)                |
| Maximum in-memory rows (`maxTotalRows`) | 100,000 (default); configurable up to ~500,000 with Worker mode |

#### Memory

| Scenario                | Guidance                                            |
| ----------------------- | --------------------------------------------------- |
| Static array, 100k rows | ~80MB JS heap                                       |
| Worker mode, 100k rows  | ~60MB main thread + ~60MB worker thread             |
| IndexedDB cache         | TTL-controlled; evict on logout; no hard size limit |

#### Canvas vs DOM backend

Use `renderMode: 'canvas'` when:

- Row count exceeds 100,000 and scroll smoothness is critical
- You need to minimize DOM node count for embedding in complex dashboards

Use `renderMode: 'dom'` (default) when:

- Plugin `registerFieldRenderer` returns `HTMLElement` instances
- Custom CSS selectors must target cell elements
- Accessibility tooling must inspect individual cells

---

### 8. Vulnerability Reporting

To report a security vulnerability, please **do not open a public GitHub issue**. Instead, email:

> **funky856@naver.com**

Include:

- A description of the vulnerability
- Steps to reproduce
- Affected TraceScope version and browser
- Potential impact assessment

We aim to acknowledge reports within 3 business days and publish patches within 30 days of confirmation.

---

## 한국어 설명서

### 적용 범위

이 문서는 **TraceScope를 SOC, SIEM, SOAR 제품에 임베딩하는 팀**을 위한 운영 보안 정책 가이드입니다.

---

### 1. 인증 및 토큰 처리

TraceScope 자체는 인증 토큰을 저장·관리·전송하지 않습니다. 토큰은 어댑터 생성 시 `headers` 옵션으로 전달되고, 각 `fetch` 또는 WebSocket 연결에 그대로 사용됩니다.

```js
// REST 어댑터에 Bearer 토큰 전달
const adapter = new ServerRangeAdapter({
  url: "/api/events",
  headers: { Authorization: `Bearer ${getAccessToken()}` },
  credentials: "same-origin",
});

// 세션 갱신 시 어댑터만 교체 — TraceScope 재시작 불필요
viewer.setDataSource(
  new ServerRangeAdapter({
    url: "/api/events",
    headers: { Authorization: `Bearer ${newToken}` },
  }),
);
```

**토큰 저장 위치별 권장사항:**

| 위치             | 위험              | 권장 여부                                               |
| ---------------- | ----------------- | ------------------------------------------------------- |
| `localStorage`   | XSS에 노출        | 장기 토큰에 비권장                                      |
| `sessionStorage` | 탭 범위, XSS 노출 | 세션 토큰에 허용                                        |
| `httpOnly` 쿠키  | XSS 차단          | Auth 쿠키에 권장                                        |
| 메모리(JS 변수)  | 새로고침 시 소멸  | Access Token에 권장; Refresh Token은 httpOnly 쿠키 병용 |

---

### 2. Content Security Policy (CSP)

```
Content-Security-Policy:
  default-src 'self';
  script-src  'self';
  style-src   'self' 'unsafe-inline';
  worker-src  'self' blob:;
  connect-src 'self' wss://siem.example.com https://siem.example.com;
```

**`style-src 'unsafe-inline'` 필요 이유:** 행 높이, 컬럼 너비, 테마 전환 시 인라인 `style` 속성이 설정됩니다. 이를 제거하면 Nonce 기반 CSP로 전환해야 합니다.

**`worker-src 'self' blob:'` 필요 이유:** `WorkerBridge`가 ES 모듈 Worker를 생성합니다. 번들러에 따라 `blob:` 소스가 필요할 수 있습니다.

**`connect-src`:** 사용 중인 SIEM API 도메인, WebSocket 서버(`wss://`), GeoIP·위협 인텔 API 엔드포인트를 반드시 추가하세요.

---

### 3. PII 마스킹 정책

TraceScope는 `dataSource`에 전달된 데이터를 그대로 화면에 표시합니다. **데이터 파이프라인(서버 측)에서 PII를 1차 마스킹한 후** TraceScope에 전달하는 것을 원칙으로 합니다. `MaskingPlugin`은 디스플레이 레이어의 2차 마스킹 역할입니다.

**권장 마스킹 계층:**

```
데이터 파이프라인 → 1차 PII 마스킹 (서버 측)
       ↓
TraceScope MaskingPlugin → 2차 디스플레이 마스킹
```

**SOC 1·2 Tier 배포 예시:**

```js
// Tier 1 (일반 분석가) — 완전 마스킹, 원문 보기 불가
MaskingPlugin.configure({
  fields: ["user", "src_ip", "dst_ip", "email", "session_id"],
  pattern: "***",
  reveal: false,
});

// Tier 2/3 (시니어 분석가) — 클릭으로 원문 확인 가능
MaskingPlugin.configure({
  fields: ["user", "email"],
  pattern: "***",
  reveal: true,
});

// 런타임 역할 기반 토글
viewer.emit("masking:toggle", { enabled: userRole !== "senior" });
```

**Raw Log 주의사항:** `MaskingPlugin`은 파싱 필드 테이블과 셀 렌더러에만 적용됩니다. `rawLog` 탭에 표시되는 원문 로그는 자동으로 마스킹되지 않으므로, 데이터 파이프라인에서 `event.raw_log`를 미리 정제하거나 커스텀 플러그인으로 정규식 치환을 적용하세요.

---

### 4. 데이터 보존 및 IndexedDB 캐시

**ChunkCache 설정:**

```js
const adapter = new CachedServerRangeAdapter(
  new ServerRangeAdapter({ url: "/api/events" }),
  { dbName: "trace-scope-events", ttl: 2 * 60 * 1000 }, // 2분 TTL
);
```

| 상황           | 캐시 동작                                                                     |
| -------------- | ----------------------------------------------------------------------------- |
| TTL 만료       | 다음 읽기 시 자동 제거                                                        |
| 필터/정렬 변경 | 자동 전체 삭제                                                                |
| 로그아웃       | `adapter.destroy()` 호출 또는 `indexedDB.deleteDatabase('trace-scope-events')` |

**권장사항:** 사용자 로그아웃 또는 세션 만료 시 반드시 IndexedDB 데이터베이스를 삭제하세요.

**라이브 이벤트 버퍼:** LiveController가 메모리에 보관하는 이벤트는 `maxTotalRows`까지이며 페이지 새로고침 시 사라집니다. 영구 저장소에 기록되지 않습니다.

---

### 5. Export 거버넌스

**기본 내보내기 규칙:**

| 상황             | 내보내기 범위                |
| ---------------- | ---------------------------- |
| 전체 행 ≤ 10,000 | 현재 필터 적용된 전체 행     |
| 전체 행 > 10,000 | 선택된 이벤트 + 상위 1,000행 |

**내보내기 비활성화:** `ExportPlugin`을 등록하지 않으면 내보내기 기능이 없습니다. 역할 기반 제어:

```js
if (userHasPermission("export_events")) {
  TraceScope.use(ExportPlugin);
}
```

**내보내기 감사 로그:**

```js
viewer.on("event:action", ({ actionId, event }) => {
  if (actionId.startsWith("export-")) {
    auditLog.record({
      action: actionId,
      user: currentUser.id,
      timestamp: new Date().toISOString(),
    });
  }
});
```

**SOAR 플레이북:** `SoarPlugin`이 외부 API를 호출할 때 페이로드에 Raw Log 전체를 포함하지 않도록 `payload` 옵션을 최소화하고, SOAR 플랫폼의 감사 로그와 연동하세요.

---

### 6. 브라우저 지원 매트릭스

| 브라우저            | 최소 버전 | 비고                                  |
| ------------------- | --------- | ------------------------------------- |
| Chrome / Edge       | 90+       | Worker 모드 포함 완전 지원            |
| Firefox             | 90+       | 완전 지원                             |
| Safari              | 15.4+     | 15.4 미만에서 `EventTarget` 상속 문제 |
| Mobile Safari (iOS) | 15.4+     | iPhone 13+ 기준 테스트                |
| Samsung Internet    | 16+       | Chromium 96+ 기반                     |

**Internet Explorer는 지원하지 않습니다.** ES 모듈, `import.meta.url`, Optional Chaining 사용으로 IE 구동이 불가능합니다.

---

### 7. 성능 SLO

`npm run benchmark` 기준 (Intel Core i5 2.4GHz 중급 노트북 CPU):

| 시나리오                       | 목표      | 실측              |
| ------------------------------ | --------- | ----------------- |
| 초기 렌더 — 5,000행            | < 500ms   | ~120ms            |
| 초기 렌더 — 50,000행 (Worker)  | < 1,000ms | ~300ms            |
| 필터 적용 — 100,000행 (Worker) | < 100ms   | ~13ms             |
| 정렬 — 100,000행 (Worker)      | < 100ms   | ~7ms              |
| 그룹핑 — 50,000행              | < 200ms   | ~5ms              |
| 스크롤 FPS (DOM 백엔드)        | ≥ 60 fps  | ≥ 60 fps (Chrome) |

**라이브 처리량:** 초당 최대 5,000건 (200ms 버퍼 flush 기준)

**메모리 가이드:**

| 상황                | JS 힙                     |
| ------------------- | ------------------------- |
| 정적 배열, 100k행   | ~80MB                     |
| Worker 모드, 100k행 | 메인 ~60MB + Worker ~60MB |

---

### 8. 취약점 신고

보안 취약점을 발견하면 **GitHub 이슈를 열지 말고** 아래 이메일로 연락하세요.

> **funky856@naver.com**

회신 목표: **3 영업일 이내 접수 확인**, **30일 이내 패치 배포**.
