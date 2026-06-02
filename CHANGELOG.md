# Changelog

All notable changes to TraceScope are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- `clearSelection()` public API method
- `worker` option added to TypeScript `TraceScopeOptions` type

### Fixed
- `setDataSource()` now correctly re-wraps the new adapter in `WorkerBridge` when `worker` mode is enabled
- `clearSelection()` was declared in TypeScript types but had no implementation

---

## [0.1.0] — 2026-06-02

Initial public release.

### Phase 1 — MVP
- `EventBus`, `OptionsNormalizer`, `PluginRegistry`, `PluginContext` core infrastructure
- `StaticArrayAdapter`, `AsyncFunctionAdapter`, `DataSourceFactory`
- Virtual scroll engine with fixed row height and row pooling
- `EventGrid` with `ColumnManager`, `HeaderRenderer`, `RowRenderer`, `SelectionManager`, `NewEventBadge`
- `HighlightEngine` — row/cell/token highlight rules
- `FilterEngine` + `FilterBar` with filter chips and `DateRangePicker`
- `RawLogViewer` + `LogTokenizer` (auto-detect IP / URL / hash tokens)
- `ParsedFieldViewer` — key-value table, JSON view, field pin
- `EventTimeline` — processing history UI
- `ActionBar` — custom action registration
- `EventDetailPanel` — tab-based detail panel (right layout)
- `LiveController` + `LiveStatusBar` — real-time event append/prepend
- Dark / Light theme system via CSS variables
- TypeScript type declarations (`types/index.d.ts`)

### Phase 2 — Performance & Data
- `WorkerBridge` + `DataWorker` — filter/sort off main thread with transparent fallback
- `ServerRangeAdapter` — offset-based REST API with `AbortController`
- `WebSocketAdapter` — WebSocket live stream with auto-reconnect
- `SSEAdapter` — Server-Sent Events streaming
- `ChunkCache` — IndexedDB TTL cache
- `CachedServerRangeAdapter` — `ServerRangeAdapter` + `ChunkCache` integration

### Phase 3 — UI Enhancements
- `ColumnManager` — visibility toggle, drag reorder
- `HeaderRenderer` — drag handles, column picker dropdown, horizontal scroll sync
- `RelatedEvents` — related event lookup by `session_id`, `rule_id`, `src_ip`, `dst_ip`, `user`, `asset`
- `DateRangePicker` — custom calendar component
- Filter chips display in `FilterBar`
- Professional color palette with severity badges (dot + text, no emoji)

### Phase 4 — Plugin Ecosystem (initial)
- `ExportPlugin` — CSV / JSON / JSONL export via `TraceScope.use(ExportPlugin)`
