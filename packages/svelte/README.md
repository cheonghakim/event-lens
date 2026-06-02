# @trace-scope/svelte

Svelte wrapper for [TraceScope](../../README.md).

## Installation / 설치

```bash
npm install trace-scope @trace-scope/svelte
```

## Usage / 사용법

```svelte
<script>
  import TraceScope from '@trace-scope/svelte/src/TraceScope.svelte'
  let viewer

  const events = [...]
</script>

<div style="height: 100vh">
  <TraceScope
    bind:this={viewer}
    dataSource={events}
    theme="dark"
    density="normal"
    live={{ enabled: true, maxTotalRows: 50000 }}
    worker={true}
    on:event-selected={({ detail: { event } }) => console.log(event)}
    on:filter-changed={({ detail: filter }) => console.log(filter)}
  />
</div>
```

Note: `event:selected` → dispatched as `event-selected` (colons replaced with hyphens per Svelte event convention).

## Methods

```js
viewer.applyFilter({ severity: ['critical'] })
viewer.scrollToTop()
viewer.pauseLive()
viewer.clearSelection()
```
