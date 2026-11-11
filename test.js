const test = require('brittle')
const { Variable, Snapshot, AsyncLocalStorage } = require('.')

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('variable: name, default, run and get', (t) => {
  const v = new Variable({ name: 'request', defaultValue: 'none' })

  t.is(v.name, 'request')
  t.is(v.get(), 'none')
  t.is(
    v.run('r1', () => v.get()),
    'r1'
  )
  t.is(v.get(), 'none', 'restored after run')
})

test('variable: run passes arguments and returns the result', (t) => {
  const v = new Variable()

  t.is(
    v.run('x', (a, b) => a + b + v.get(), 1, 2),
    '3x'
  )
})

test('variable: nesting restores the outer value', (t) => {
  const v = new Variable()

  v.run('outer', () => {
    v.run('inner', () => t.is(v.get(), 'inner'))
    t.is(v.get(), 'outer')
  })
  t.is(v.get(), undefined)
})

test('variable: run(undefined) hides the value but not the default', (t) => {
  const v = new Variable({ defaultValue: 'none' })

  t.is(
    v.run('r1', () => v.run(undefined, () => v.get())),
    undefined
  )
})

test('variable: restored when fn throws', (t) => {
  const v = new Variable()

  t.exception(() =>
    v.run('x', () => {
      throw new Error('boom')
    })
  )
  t.is(v.get(), undefined)
})

test('variable: two variables never share a value', (t) => {
  const a = new Variable({ name: 'same' })
  const b = new Variable({ name: 'same' })

  a.run('A', () => {
    t.is(a.get(), 'A')
    t.is(b.get(), undefined)
  })
})

test('variable: survives await', async (t) => {
  const v = new Variable()

  await v.run('r1', async () => {
    await tick()
    t.is(v.get(), 'r1')
  })
  t.is(v.get(), undefined)
})

test('variable: concurrent runs stay separate across awaits', async (t) => {
  const v = new Variable()

  const seen = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      v.run(`r${n}`, async () => {
        await new Promise((resolve) => setTimeout(resolve, (n * 7) % 5))
        return v.get()
      })
    )
  )

  t.alike(seen, ['r1', 'r2', 'r3', 'r4', 'r5'])
})

test('snapshot: run restores every variable at once', (t) => {
  const a = new Variable()
  const b = new Variable()

  const snapshot = a.run('A', () => b.run('B', () => new Snapshot()))

  t.alike(
    a.run('other', () => snapshot.run(() => [a.get(), b.get()])),
    ['A', 'B']
  )
  t.alike([a.get(), b.get()], [undefined, undefined], 'nothing leaks out')
})

test('snapshot: wrap keeps this and arguments', (t) => {
  const v = new Variable()

  const obj = {
    label: 'room',
    describe: v.run('captured', () =>
      Snapshot.wrap(function (suffix) {
        return `${this.label} ${v.get()} ${suffix}`
      })
    )
  }

  t.is(obj.describe('!'), 'room captured !')
})

test('timers: callbacks run in the context they were created in', async (t) => {
  const v = new Variable()

  const seen = await v.run('r1', () =>
    Promise.all([
      new Promise((resolve) => setTimeout(() => resolve(v.get()), 1)),
      new Promise((resolve) => setImmediate(() => resolve(v.get())))
    ])
  )

  t.alike(seen, ['r1', 'r1'])
})

test('async local storage: run, getStore and exit', (t) => {
  const als = new AsyncLocalStorage()

  t.is(als.getStore(), undefined)
  als.run('x', () => {
    t.is(als.getStore(), 'x')
    als.exit(() => t.is(als.getStore(), undefined))
    t.is(als.getStore(), 'x')
  })
})

test('async local storage: bind and snapshot', (t) => {
  const als = new AsyncLocalStorage()

  const bound = als.run('captured', () => AsyncLocalStorage.bind(() => als.getStore()))
  const runInScope = als.run('captured', () => AsyncLocalStorage.snapshot())

  t.is(bound(), 'captured')
  t.is(
    runInScope(() => als.getStore()),
    'captured'
  )
})

test('binding: keys must be symbols', (t) => {
  const binding = require('./binding')

  t.exception(() => binding.get('not a symbol'))
})
