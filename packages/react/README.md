# @trace-scope/react

React wrapper for [TraceScope](../../README.md).

## Installation / 설치

```bash
npm install trace-scope @trace-scope/react
```

## Usage / 사용법

```jsx
import { TraceScopeViewer } from '@trace-scope/react'

export function Dashboard() {
  const viewerRef = useRef(null)

  return (
    <div style={{ height: '100vh' }}>
      <TraceScopeViewer
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

All [TraceScopeOptions](../../README.md#options-reference--옵션-레퍼런스) are available as props. Event callbacks use camelCase: `onEventSelected`, `onFilterChanged`, etc.

## Ref Methods

```jsx
viewerRef.current.applyFilter({ severity: ['critical'] })
viewerRef.current.scrollToTop()
viewerRef.current.pauseLive()
viewerRef.current.clearSelection()
```
