export class EventBus {
  constructor() {
    this._listeners = new Map()
  }

  on(event, cb) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set())
    this._listeners.get(event).add(cb)
    return this
  }

  off(event, cb) {
    this._listeners.get(event)?.delete(cb)
    return this
  }

  once(event, cb) {
    const wrapper = (data) => { cb(data); this.off(event, wrapper) }
    return this.on(event, wrapper)
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach(cb => {
      try { cb(data) } catch (e) { console.error(`[EventLens] EventBus error on "${event}":`, e) }
    })
    return this
  }

  clear() {
    this._listeners.clear()
  }
}
