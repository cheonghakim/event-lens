export class RowPool {
  constructor(createFn) {
    this._pool  = []
    this._createFn = createFn
  }

  acquire() {
    return this._pool.pop() || this._createFn()
  }

  release(node) {
    this._pool.push(node)
  }

  releaseAll(nodes) {
    for (const n of nodes) this.release(n)
  }

  clear() {
    this._pool = []
  }
}
