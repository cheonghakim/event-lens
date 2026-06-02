<template>
  <div ref="containerRef" class="event-lens-vue-wrapper" />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, toRaw } from 'vue'
import { EventLens } from 'event-lens'
import 'event-lens/style'

const props = defineProps({
  dataSource:     { required: true },
  columns:        { type: Array,   default: null },
  theme:          { type: String,  default: 'dark' },
  density:        { type: String,  default: 'normal' },
  live:           { default: false },
  worker:         { default: false },
  detail:         { default: undefined },
  highlightRules: { type: Array,   default: () => [] },
  actions:        { type: Array,   default: () => [] },
  plugins:        { type: Array,   default: () => [] },
  locale:         { type: String,  default: 'ko-KR' },
})

const emit = defineEmits([
  'event:selected',
  'event:deselected',
  'event:action',
  'live:new-events',
  'live:connected',
  'live:disconnected',
  'filter:changed',
  'sort:changed',
])

const containerRef = ref(null)
let _viewer = null

const EVENTS = [
  'event:selected', 'event:deselected', 'event:action',
  'live:new-events', 'live:connected', 'live:disconnected',
  'filter:changed', 'sort:changed',
]

function createViewer() {
  if (_viewer) { _viewer.destroy(); _viewer = null }

  _viewer = new EventLens({
    container:      containerRef.value,
    dataSource:     toRaw(props.dataSource),
    columns:        props.columns ? toRaw(props.columns) : undefined,
    theme:          props.theme,
    density:        props.density,
    live:           toRaw(props.live),
    worker:         toRaw(props.worker),
    detail:         props.detail !== undefined ? toRaw(props.detail) : undefined,
    highlightRules: toRaw(props.highlightRules),
    actions:        toRaw(props.actions),
    plugins:        toRaw(props.plugins),
    locale:         props.locale,
  })

  for (const ev of EVENTS) {
    _viewer.on(ev, (data) => emit(ev, data))
  }
}

onMounted(() => createViewer())

onBeforeUnmount(() => {
  _viewer?.destroy()
  _viewer = null
})

watch(() => props.dataSource, (ds) => {
  _viewer?.setDataSource(toRaw(ds))
})

watch(() => props.theme, (t) => {
  if (_viewer?._rootEl) _viewer._rootEl.dataset.elTheme = t
})

watch(() => props.density, (d) => {
  if (_viewer?._rootEl) _viewer._rootEl.dataset.elDensity = d
})

defineExpose({
  viewer:         () => _viewer,
  refresh:        ()  => _viewer?.refresh(),
  applyFilter:    (f) => _viewer?.applyFilter(f),
  clearFilter:    ()  => _viewer?.clearFilter(),
  setSort:        (s) => _viewer?.setSort(s),
  scrollToTop:    ()  => _viewer?.scrollToTop(),
  scrollToBottom: ()  => _viewer?.scrollToBottom(),
  pauseLive:      ()  => _viewer?.pauseLive(),
  resumeLive:     ()  => _viewer?.resumeLive(),
  destroy:        ()  => _viewer?.destroy(),
})
</script>

<style scoped>
.event-lens-vue-wrapper {
  width:  100%;
  height: 100%;
}
</style>
