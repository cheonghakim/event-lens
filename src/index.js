import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/severity.css'
import './styles/ui.css'
import './styles/theme-light.css'
import './styles/theme-dark.css'

// ── Core ─────────────────────────────────────────────────────────────────────
export { EventLens }         from './core/TraceScope.js'
export { EventBus }          from './core/EventBus.js'

// ── Phase 1: Data sources ─────────────────────────────────────────────────────
export { StaticArrayAdapter }   from './data-source/StaticArrayAdapter.js'
export { AsyncFunctionAdapter } from './data-source/AsyncFunctionAdapter.js'

// ── Phase 2: Data sources ─────────────────────────────────────────────────────
export { ServerRangeAdapter }   from './data-source/ServerRangeAdapter.js'
export { WebSocketAdapter }     from './data-source/WebSocketAdapter.js'
export { SSEAdapter }           from './data-source/SSEAdapter.js'

// ── Phase 2: Worker ───────────────────────────────────────────────────────────
export { WorkerBridge }         from './worker/WorkerBridge.js'

// ── Phase 2: Cache ────────────────────────────────────────────────────────────
export { ChunkCache, CachedServerRangeAdapter } from './cache/ChunkCache.js'

// ── Phase 3: UI components ────────────────────────────────────────────────────
export { DateRangePicker }      from './ui/DateRangePicker.js'
export { RelatedEvents }        from './related/RelatedEvents.js'

// ── Core extras ───────────────────────────────────────────────────────────────
export { StateManager }         from './core/StateManager.js'

// ── Phase 4: Plugins ──────────────────────────────────────────────────────────
export { ExportPlugin }         from './plugins/exportPlugin.js'
export { GeoIpPlugin }          from './plugins/geoIpPlugin.js'
export { LocalGeoIpPlugin }     from './plugins/geoip/LocalGeoIpPlugin.js'
export { LocalGeoIpLookup }     from './plugins/geoip/LocalGeoIpLookup.js'
export { ThreatIntelPlugin }    from './plugins/threatIntelPlugin.js'
export { MitrePlugin }          from './plugins/mitrePlugin.js'
export { MaskingPlugin }        from './plugins/maskingPlugin.js'
export { SoarPlugin }           from './plugins/soarPlugin.js'

// ── Phase 5: Rendering ────────────────────────────────────────────────────────
export { RenderBackend }        from './render/RenderBackend.js'
export { DomRenderBackend }     from './render/DomRenderBackend.js'
export { CanvasRenderBackend }  from './render/CanvasRenderBackend.js'

// ── Phase 5: Scroll ───────────────────────────────────────────────────────────
export { HeightCache }          from './scroll/HeightCache.js'
export { PositionIndex }        from './scroll/PositionIndex.js'
export { DENSITY_ROW_HEIGHTS }  from './scroll/VirtualScrollEngine.js'

// ── Phase 5: Grouping ─────────────────────────────────────────────────────────
export { GroupingEngine }       from './grid/GroupingEngine.js'

// ── Engines ───────────────────────────────────────────────────────────────────
export { HighlightEngine }      from './highlight/HighlightEngine.js'
export { FilterEngine }         from './filter/FilterEngine.js'
export { buildFilterFn, buildSortCompareFn } from './filter/filterUtils.js'
