import { PluginContext } from '../plugins/PluginContext.js'

export class PluginRegistry {
  constructor(core) {
    this._core = core
    this._installed = new Map()
    this.ctx = new PluginContext(core)
  }

  register(plugin) {
    if (!plugin || !plugin.name) {
      console.warn('[TraceScope] Plugin must have a name property')
      return
    }
    if (this._installed.has(plugin.name)) {
      console.warn(`[TraceScope] Plugin "${plugin.name}" is already installed`)
      return
    }
    try {
      plugin.install(this.ctx)
      this._installed.set(plugin.name, plugin)
    } catch (e) {
      console.error(`[TraceScope] Plugin "${plugin.name}" install failed:`, e)
    }
  }

  has(name) {
    return this._installed.has(name)
  }
}
