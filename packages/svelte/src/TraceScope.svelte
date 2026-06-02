<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  import { TraceScope } from 'trace-scope'
  import 'trace-scope/style'

  // Props
  export let dataSource
  export let columns        = undefined
  export let theme          = 'dark'
  export let density        = 'normal'
  export let live           = false
  export let worker         = false
  export let detail         = undefined
  export let highlightRules = []
  export let actions        = []
  export let plugins        = []
  export let locale         = 'ko-KR'

  const dispatch = createEventDispatcher()

  let container
  let _viewer = null

  const EVENTS = [
    'event:selected', 'event:deselected', 'event:action',
    'live:new-events', 'live:connected', 'live:disconnected',
    'filter:changed', 'sort:changed',
  ]

  onMount(() => {
    _viewer = new TraceScope({
      container,
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

    for (const ev of EVENTS) {
      _viewer.on(ev, (data) => dispatch(ev.replace(':', '-'), data))
    }
  })

  onDestroy(() => {
    _viewer?.destroy()
    _viewer = null
  })

  // Reactive updates
  $: if (_viewer && dataSource !== undefined) _viewer.setDataSource(dataSource)
  $: if (_viewer?._rootEl && theme)   _viewer._rootEl.dataset.tsTheme   = theme
  $: if (_viewer?._rootEl && density) _viewer._rootEl.dataset.tsDensity = density

  // Expose imperative API
  export function refresh()        { return _viewer?.refresh() }
  export function applyFilter(f)   { return _viewer?.applyFilter(f) }
  export function clearFilter()    { return _viewer?.clearFilter() }
  export function setSort(s)       { return _viewer?.setSort(s) }
  export function scrollToTop()    { return _viewer?.scrollToTop() }
  export function scrollToBottom() { return _viewer?.scrollToBottom() }
  export function pauseLive()      { return _viewer?.pauseLive() }
  export function resumeLive()     { return _viewer?.resumeLive() }
  export function clearSelection() { return _viewer?.clearSelection() }
  export function getViewer()      { return _viewer }
</script>

<div bind:this={container} class="trace-scope-svelte-wrapper" />

<style>
  .trace-scope-svelte-wrapper {
    width:  100%;
    height: 100%;
  }
</style>
