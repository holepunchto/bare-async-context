const binding = require('./binding')

// The key for our entry in the engine's continuation data. Symbol.for rather
// than Symbol, so that two copies of this module (say, the one built into Bare
// and one in an app's node_modules) share ONE entry instead of each having
// their own, which would lose one copy's values across the other's timers.
const token = Symbol.for('bare.async-context')

// The current frame: an immutable Map from each Variable to its value.
function current() {
  return binding.get(token)
}

// Make `frame` current and return the frame it replaced.
function exchange(frame) {
  const prior = binding.get(token)

  binding.set(token, frame)

  return prior
}

function restore(prior) {
  binding.set(token, prior)
}

class Variable {
  #name
  #defaultValue

  constructor(opts = {}) {
    this.#name = opts.name || ''
    this.#defaultValue = opts.defaultValue
  }

  get name() {
    return this.#name
  }

  get() {
    const frame = current()

    return frame !== undefined && frame.has(this) ? frame.get(this) : this.#defaultValue
  }

  run(value, fn, ...args) {
    // A new frame: never change one that continuations may already hold.
    const frame = new Map(current())

    frame.set(this, value)

    const prior = exchange(frame)

    try {
      return Reflect.apply(fn, null, args)
    } finally {
      restore(prior)
    }
  }
}

class Snapshot {
  #frame = current()

  run(fn, ...args) {
    const prior = exchange(this.#frame)

    try {
      return Reflect.apply(fn, null, args)
    } finally {
      restore(prior)
    }
  }

  static wrap(fn) {
    const snapshot = new Snapshot()

    return function wrapped(...args) {
      const prior = exchange(snapshot.#frame)

      try {
        return Reflect.apply(fn, this, args)
      } finally {
        restore(prior)
      }
    }
  }
}

// Node's API, as a thin layer over Variable and Snapshot.
class AsyncLocalStorage {
  #variable

  constructor(opts = {}) {
    this.#variable = new Variable(opts)
  }

  static snapshot() {
    const snapshot = new Snapshot()

    return function runInAsyncScope(fn, ...args) {
      return snapshot.run(fn, ...args)
    }
  }

  static bind(fn) {
    return Snapshot.wrap(fn)
  }

  run(store, fn, ...args) {
    return this.#variable.run(store, fn, ...args)
  }

  exit(fn, ...args) {
    return this.#variable.run(undefined, fn, ...args)
  }

  getStore() {
    return this.#variable.get()
  }
}

module.exports = { Variable, Snapshot, AsyncLocalStorage }
