import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { TraceScope } from 'trace-scope'
import 'trace-scope/style'

/**
 * React wrapper for TraceScope.
 *
 * @example
 * <TraceScopeViewer
 *   dataSource={events}
 *   theme="dark"
 *   density="normal"
 *   onEventSelected={({ event }) => console.log(event)}
 * />
 */
const TraceScopeViewer = forwardRef(function TraceScopeViewer(props, ref) {
  const {
    dataSource,
    columns,
    theme       = 'dark',
    density     = 'normal',
    live        = false,
    worker      = false,
    detail,
    highlightRules = [],
    actions        = [],
    plugins        = [],
    locale         = 'ko-KR',
    style,
    className,
    // Event callbacks
    onEventSelected,
    onEventDeselected,
    onEventAction,
    onLiveNewEvents,
    onLiveConnected,
    onLiveDisconnected,
    onFilterChanged,
    onSortChanged,
  } = props

  const containerRef = useRef(null)
  const viewerRef    = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const viewer = new TraceScope({
      container:      containerRef.current,
      dataSource,
      columns,
      theme,
      density,
      live,
      worker,
      detail,
      highlightRules,
      actions,
      plugins,
      locale,
    })
    viewerRef.current = viewer

    if (onEventSelected)    viewer.on('event:selected',    onEventSelected)
    if (onEventDeselected)  viewer.on('event:deselected',  onEventDeselected)
    if (onEventAction)      viewer.on('event:action',      onEventAction)
    if (onLiveNewEvents)    viewer.on('live:new-events',   onLiveNewEvents)
    if (onLiveConnected)    viewer.on('live:connected',    onLiveConnected)
    if (onLiveDisconnected) viewer.on('live:disconnected', onLiveDisconnected)
    if (onFilterChanged)    viewer.on('filter:changed',    onFilterChanged)
    if (onSortChanged)      viewer.on('sort:changed',      onSortChanged)

    return () => {
      viewer.destroy()
      viewerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Hot-swap dataSource
  useEffect(() => {
    viewerRef.current?.setDataSource(dataSource)
  }, [dataSource])

  // Theme change
  useEffect(() => {
    const v = viewerRef.current
    if (v?._rootEl) v._rootEl.dataset.tsTheme = theme
  }, [theme])

  // Density change
  useEffect(() => {
    const v = viewerRef.current
    if (v?._rootEl) v._rootEl.dataset.tsDensity = density
  }, [density])

  useImperativeHandle(ref, () => ({
    viewer:         () => viewerRef.current,
    refresh:        ()  => viewerRef.current?.refresh(),
    applyFilter:    (f) => viewerRef.current?.applyFilter(f),
    clearFilter:    ()  => viewerRef.current?.clearFilter(),
    setSort:        (s) => viewerRef.current?.setSort(s),
    scrollToTop:    ()  => viewerRef.current?.scrollToTop(),
    scrollToBottom: ()  => viewerRef.current?.scrollToBottom(),
    pauseLive:      ()  => viewerRef.current?.pauseLive(),
    resumeLive:     ()  => viewerRef.current?.resumeLive(),
    clearSelection: ()  => viewerRef.current?.clearSelection(),
  }))

  return (
    <div
      ref={containerRef}
      className={['trace-scope-react-wrapper', className].filter(Boolean).join(' ')}
      style={{ width: '100%', height: '100%', ...style }}
    />
  )
})

export { TraceScopeViewer }
export default TraceScopeViewer
