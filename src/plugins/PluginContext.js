export class PluginContext {
  constructor(core) {
    this._core = core
    this._fieldRenderers = new Map()
    this._actions = []
    this._timelineSteps = new Map()
    this._columnDecorators = new Map()
    this._rowDecorators = []
  }

  registerFieldRenderer(fieldName, renderer) {
    this._fieldRenderers.set(fieldName, renderer)
  }

  getFieldRenderer(fieldName) {
    return this._fieldRenderers.get(fieldName) || null
  }

  registerAction(actionId, config) {
    this._actions.push({ id: actionId, ...config })
  }

  getActions() {
    return this._actions
  }

  registerTimelineStep(type, config) {
    this._timelineSteps.set(type, config)
  }

  registerColumnDecorator(columnId, decorator) {
    this._columnDecorators.set(columnId, decorator)
  }

  registerRowDecorator(fn) {
    this._rowDecorators.push(fn)
  }

  getRowDecorators() {
    return this._rowDecorators
  }

  on(event, cb) {
    this._core.on(event, cb)
  }

  emit(event, data) {
    this._core.emit(event, data)
  }

  getOptions() {
    return this._core._options
  }
}
