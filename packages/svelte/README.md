# @event-lens/svelte

Svelte wrapper for [EventLens](../../README.md).

## Installation / 설치

```bash
npm install event-lens @event-lens/svelte
```

## Usage / 사용법

```svelte
<script>
  import EventLens from '@event-lens/svelte/src/EventLens.svelte'
  let viewer

  const events = [...]
</script>

<div style="height: 100vh">
  <EventLens
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
