// EventLens — TypeScript type definitions

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unknown'
export type Theme    = 'dark' | 'light' | 'auto'
export type Density  = 'compact' | 'normal' | 'comfortable'
export type DetailLayout = 'right' | 'bottom' | 'drawer' | 'modal' | 'split'
export type RenderMode = 'dom' | 'canvas'

// ── SecurityEvent ─────────────────────────────────────────────────────────────
export interface SecurityEvent {
  id:         string
  timestamp:  string              // ISO 8601
  severity:   Severity
  risk_score?: number             // 0–100
  src_ip?:    string
  dst_ip?:    string
  src_port?:  number
  dst_port?:  number
  protocol?:  string
  user?:      string
  asset?:     string
  action?:    string
  rule_id?:   string
  rule_name?: string
  session_id?: string
  event_type?: string
  raw_log?:   string
  parsed?:    Record<string, unknown>
  timeline?:  EventTimelineItem[]
  [key: string]: unknown
}

// ── EventTimelineItem ─────────────────────────────────────────────────────────
export type TimelineStepStatus =
  | 'done' | 'running' | 'failed' | 'pending' | 'skipped' | 'escalated'

export interface EventTimelineItem {
  id:      string
  type:    'detection' | 'alert' | 'investigation' | 'escalation' | 'soar_action' | 'resolution' | 'audit' | string
  time?:   string
  status:  TimelineStepStatus
  actor?:  string
  detail?: string
  metadata?: Record<string, unknown>
}

// ── EventColumn ───────────────────────────────────────────────────────────────
export type CellRenderer = (value: unknown, event: SecurityEvent, column: EventColumn) => string | HTMLElement

export interface EventColumn {
  id:         string
  field:      string
  label:      string
  width?:     number
  minWidth?:  number
  sortable?:  boolean
  resizable?: boolean
  visible?:   boolean
  fixed?:     'left' | 'right'
  renderer?:  CellRenderer
}

// ── DataSource ────────────────────────────────────────────────────────────────
export interface GetRowsParams {
  start:   number
  end:     number
  sort?:   EventSort
  filter?: EventFilter
  signal?: AbortSignal
}

export interface GetRowsResult {
  rows:        SecurityEvent[]
  totalCount?: number
}

export interface EventDataSource {
  getRows(params: GetRowsParams): Promise<GetRowsResult>
  getRowById(id: string): Promise<SecurityEvent | null>
  getTotalCount?(): number
  applyFilter?(fn: ((e: SecurityEvent) => boolean) | null): void
  applySort?(compareFn: (a: SecurityEvent, b: SecurityEvent) => number): void
  subscribe?(callback: (events: SecurityEvent[]) => void): void
  unsubscribe?(): void
  pushLiveEvents?(events: SecurityEvent[]): void
  isServerSide?(): boolean
}

// ── EventFilter ───────────────────────────────────────────────────────────────
export interface FieldCondition {
  field: string
  op:    'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'regex'
  value: string | number | boolean
}

export interface EventFilter {
  severity?:       Severity[]
  riskScore?:      { min?: number; max?: number }
  timeRange?:      { from?: string; to?: string }
  srcIp?:          string[]
  dstIp?:          string[]
  user?:           string[]
  asset?:          string[]
  action?:         string[]
  ruleId?:         string[]
  eventType?:      string[]
  rawLogContains?: string
  parsedField?:    FieldCondition[]
  quickSearch?:    string
}

// ── EventSort ─────────────────────────────────────────────────────────────────
export interface EventSort {
  field:     string
  direction: 'asc' | 'desc'
}

// ── EventAction ───────────────────────────────────────────────────────────────
export interface ActionContext {
  viewer: EventLens
  emit:   (event: string, data: unknown) => void
}

export interface EventAction {
  id:       string
  label:    string
  icon?:    string
  builtin?: boolean
  disabled?: boolean | ((event: SecurityEvent) => boolean)
  handler:  (event: SecurityEvent, ctx: ActionContext) => void | Promise<void>
}

// ── HighlightRule ─────────────────────────────────────────────────────────────
export interface HighlightRule {
  priority?:      number
  type?:          'row' | 'cell' | 'token'
  when?:          (event: SecurityEvent) => boolean
  field?:         string
  match?:         string | RegExp
  className?:     string
  cellClassName?: string
  style?:         Partial<CSSStyleDeclaration>
  pattern?:       RegExp
  tokenClassName?: string
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export type FieldRenderer   = (value: unknown, event: SecurityEvent) => string | HTMLElement
export type EventRenderer   = (event: SecurityEvent) => HTMLElement

export interface TimelineStepConfig {
  icon?:  string
  label?: string
}

export interface PluginContext {
  registerFieldRenderer(field: string, renderer: FieldRenderer): void
  registerAction(actionId: string, config: Omit<EventAction, 'id'>): void
  registerTimelineStep(type: string, config: TimelineStepConfig): void
  registerColumnDecorator(columnId: string, decorator: (el: HTMLElement, event: SecurityEvent) => void): void
  on(event: string, cb: (data: unknown) => void): void
  emit(event: string, data: unknown): void
  getOptions(): EventLensOptions
}

export interface EventLensPlugin {
  name:    string
  install: (ctx: PluginContext) => void
}

// ── Options ───────────────────────────────────────────────────────────────────
export interface LiveOptions {
  enabled?:           boolean
  mode?:              'append' | 'prepend' | 'replace'
  maxBufferSize?:     number
  flushInterval?:     number
  autoScroll?:        'always' | 'when-at-end' | 'never'
  showNewEventBadge?: boolean
  pauseOnUserScroll?: boolean
  maxTotalRows?:      number
  evictPolicy?:       'oldest-first'
}

export interface VirtualScrollOptions {
  rowHeight?: number
  overscan?:  number
}

export interface WorkerOptions {
  enabled?: boolean
  maxRows?: number
}

export interface MaskingOptions {
  enabled: boolean
  fields:  string[]
  pattern?: string
}

export interface DetailOptions {
  layout?:         DetailLayout
  width?:          number
  height?:         number
  tabs?:           Array<'parsedFields' | 'rawLog' | 'timeline'>
  defaultTab?:     string
  rawLogOptions?:  { wrap?: 'none' | 'soft'; masking?: MaskingOptions }
}

export type DataSourceInput =
  | SecurityEvent[]
  | ((params: GetRowsParams) => Promise<GetRowsResult | SecurityEvent[]>)
  | EventDataSource
  | ServerRangeAdapterOptions
  | WebSocketAdapterOptions
  | SSEAdapterOptions

export interface ServerRangeAdapterOptions {
  type?: 'server-range'
  url: string
  pageSize?: number
  headers?: Record<string, string>
  credentials?: RequestCredentials
  responseMapper?: (raw: unknown) => GetRowsResult
  paramsMapper?: (params: {
    offset: number
    limit: number
    sort?: EventSort
    filter?: EventFilter
  }) => URLSearchParams | Record<string, string | number | boolean>
}

export interface WebSocketAdapterOptions {
  type?: 'websocket' | 'ws'
  url: string
  reconnect?: boolean
  reconnectMs?: number
  initial?: (params: GetRowsParams) => Promise<GetRowsResult | SecurityEvent[]>
  messageMapper?: (raw: unknown) => SecurityEvent[] | SecurityEvent | null
}

export interface SSEAdapterOptions {
  type?: 'sse'
  url: string
  withCredentials?: boolean
  initial?: (params: GetRowsParams) => Promise<GetRowsResult | SecurityEvent[]>
  messageMapper?: (data: string) => SecurityEvent[] | SecurityEvent | null
}

export interface EventLensOptions {
  container:        string | HTMLElement
  dataSource:       DataSourceInput
  columns?:         EventColumn[]
  theme?:           Theme
  density?:         Density
  renderMode?:      RenderMode
  groupBy?:         string | null
  live?:            LiveOptions | boolean
  virtualScroll?:   VirtualScrollOptions | boolean
  detail?:          DetailOptions | boolean
  highlightRules?:  HighlightRule[]
  actions?:         EventAction[]
  plugins?:         EventLensPlugin[]
  locale?:          string
  worker?:          WorkerOptions | boolean
}

// ── EventLens class ──────────────────────────────────────────────────────────
export declare class EventLens {
  constructor(options: EventLensOptions)

  /** Install a plugin globally (before any instance is created) */
  static use(plugin: EventLensPlugin): typeof EventLens

  /** Instance-level plugin install */
  use(plugin: EventLensPlugin): this

  on(event: 'event:selected',      cb: (data: { event: SecurityEvent }) => void): this
  on(event: 'event:deselected',    cb: (data: { eventId: string }) => void): this
  on(event: 'event:action',        cb: (data: { actionId: string; event: SecurityEvent }) => void): this
  on(event: 'live:new-events',     cb: (data: { events: SecurityEvent[]; count: number }) => void): this
  on(event: 'live:connected',      cb: () => void): this
  on(event: 'live:disconnected',   cb: (data: { reason?: string }) => void): this
  on(event: 'live:events-dropped', cb: (data: { count: number }) => void): this
  on(event: 'data:error',          cb: (data: { error: Error }) => void): this
  on(event: 'filter:changed',      cb: (data: EventFilter) => void): this
  on(event: 'sort:changed',        cb: (data: EventSort) => void): this
  on(event: 'timeline:item-click', cb: (data: { item: EventTimelineItem; event: SecurityEvent }) => void): this
  on(event: string,                cb: (data: unknown) => void): this

  off(event: string, cb: (data: unknown) => void): this
  emit(event: string, data: unknown): void

  setDataSource(dataSource: DataSourceInput): void
  refresh(): Promise<void>

  scrollToRow(id: string): void
  scrollToIndex(index: number): void
  scrollToTop(): void
  scrollToBottom(): void

  selectEvent(id: string): void
  getSelectedEvent(): Promise<SecurityEvent | null>
  clearSelection(): void

  applyFilter(filter: EventFilter): void
  clearFilter(): void
  getFilter(): EventFilter
  setSort(sort: EventSort): void

  pauseLive(): void
  resumeLive(): void
  isLivePaused(): boolean
  isWorkerActive(): boolean

  destroy(): void
}

export declare class StaticArrayAdapter implements EventDataSource {
  constructor(data: SecurityEvent[])
  getRows(params: GetRowsParams): Promise<GetRowsResult>
  getRowById(id: string): Promise<SecurityEvent | null>
  getTotalCount(): number
  applyFilter(fn: ((e: SecurityEvent) => boolean) | null): void
  applySort(compareFn: (a: SecurityEvent, b: SecurityEvent) => number): void
  subscribe(callback: (events: SecurityEvent[]) => void): void
  unsubscribe(): void
  pushLiveEvents(events: SecurityEvent[]): void
  setMaxRows(n: number): void
  isServerSide(): boolean
}

export declare class AsyncFunctionAdapter implements EventDataSource {
  constructor(loader: (params: GetRowsParams) => Promise<GetRowsResult | SecurityEvent[]>)
  getRows(params: GetRowsParams): Promise<GetRowsResult>
  getRowById(id: string): Promise<SecurityEvent | null>
}

export declare class ServerRangeAdapter implements EventDataSource {
  constructor(options: ServerRangeAdapterOptions)
}

export declare class WebSocketAdapter implements EventDataSource {
  constructor(options: WebSocketAdapterOptions)
}

export declare class SSEAdapter implements EventDataSource {
  constructor(options: SSEAdapterOptions)
}

export declare class WorkerBridge implements EventDataSource {
  constructor(adapter: EventDataSource, options?: { maxTotalRows?: number })
  isWorkerActive(): boolean
  destroy(): void
}

export declare class ChunkCache {
  constructor(options?: { dbName?: string; storeName?: string; ttl?: number })
}

export declare class CachedServerRangeAdapter implements EventDataSource {
  constructor(adapter: ServerRangeAdapter, options?: { dbName?: string; ttl?: number })
}

export declare const ExportPlugin: EventLensPlugin
export declare const GeoIpPlugin: EventLensPlugin & {
  configure(options?: Record<string, unknown>): EventLensPlugin
}
export declare const ThreatIntelPlugin: EventLensPlugin & {
  configure(options?: Record<string, unknown>): EventLensPlugin
}
export declare const MitrePlugin: EventLensPlugin & {
  configure(options?: Record<string, unknown>): EventLensPlugin
}
export declare const MaskingPlugin: EventLensPlugin & {
  configure(options?: Record<string, unknown>): EventLensPlugin
}
export declare const SoarPlugin: EventLensPlugin & {
  configure(options?: Record<string, unknown>): EventLensPlugin
}

export declare class RenderBackend {}
export declare class DomRenderBackend extends RenderBackend {}
export declare class CanvasRenderBackend extends RenderBackend {}
export declare class HeightCache {}
export declare class PositionIndex {}
export declare class GroupingEngine {}
export declare class HighlightEngine {}
export declare class FilterEngine {}
export declare function buildFilterFn(filter?: EventFilter | null): ((event: SecurityEvent) => boolean) | null
export declare function buildSortCompareFn(sort?: EventSort | null): ((a: SecurityEvent, b: SecurityEvent) => number) | null
