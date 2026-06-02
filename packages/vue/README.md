# @trace-scope/vue

Vue 3 wrapper component for [TraceScope](../../README.md).

## Installation / 설치

```bash
npm install trace-scope @trace-scope/vue
```

## Usage / 사용법

```vue
<template>
  <TraceScope
    :data-source="events"
    theme="dark"
    density="normal"
    :columns="columns"
    :highlight-rules="rules"
    :actions="actions"
    :live="liveOptions"
    :worker="true"
    @event:selected="onSelect"
    @filter:changed="onFilter"
  />
</template>

<script setup>
import { TraceScope } from '@trace-scope/vue'

const events = ref([...])
const columns = [
  { id: 'severity', field: 'severity', label: 'Severity', width: 90 },
  { id: 'timestamp', field: 'timestamp', label: 'Time', width: 148 },
]
const liveOptions = { enabled: true, maxTotalRows: 50000 }

function onSelect({ event }) {
  console.log('Selected:', event.id)
}
</script>
```

## Props

All [TraceScopeOptions](../../README.md#options-reference--옵션-레퍼런스) are available as props.

## Events

All TraceScope events are forwarded: `event:selected`, `event:deselected`, `event:action`, `live:new-events`, `live:connected`, `live:disconnected`, `filter:changed`, `sort:changed`.

## Exposed Methods

Access via template ref:

```vue
<TraceScope ref="viewer" ... />

<script setup>
const viewer = ref(null)
viewer.value.applyFilter({ severity: ['critical'] })
viewer.value.scrollToTop()
</script>
```
