# @event-lens/react

React wrapper for [EventLens](../../README.md).

## Installation / 설치

```bash
npm install event-lens @event-lens/react
```

## Usage / 사용법

```jsx
import { EventLensViewer } from '@event-lens/react'

export function Dashboard() {
  const viewerRef = useRef(null)

  return (
    <div style={{ height: '100vh' }}>
      <EventLensViewer
        ref={viewerRef}
        dataSource={events}
        theme="dark"
        density="normal"
        columns={columns}
        live={{ enabled: true, maxTotalRows: 50000 }}
        worker={true}
        onEventSelected={({ event }) => console.log(event)}
        onFilterChanged={(filter) => console.log(filter)}
      />
    </div>
  )
}
```

## Props

All [EventLensOptions](../../README.md#options-reference--옵션-레퍼런스) are available as props. Event callbacks use camelCase: `onEventSelected`, `onFilterChanged`, etc.

## Ref Methods

```jsx
viewerRef.current.applyFilter({ severity: ['critical'] })
viewerRef.current.scrollToTop()
viewerRef.current.pauseLive()
viewerRef.current.clearSelection()
```
