import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    state, calc, set, iff, run,
    eq, neq, lt, lte, gt, gte,
    add, sub, mul, div, mod, pow, neg, abs,
    sum, min, max,
    not, and, or,
    concat,
    trace, traceSend,
    num, text, bool, choice, list, record, collection,
    type Val, type Action,
} from '../src/index.js'

// ═══════════════════════════════════════════════════════════════════════════════
// Core primitives
// ═══════════════════════════════════════════════════════════════════════════════

test('get() returns initial value of a state node', () => {
    const score = state(0)
    const { get } = run()
    assert.equal(get(score), 0)
})

test('set() mutates state', () => {
    const score = state(0)
    const { get, send } = run()
    send(set(score, 42))
    assert.equal(get(score), 42)
})

test('calc() derives a value from its deps', () => {
    const level = state(1)
    const doubled = calc((x: number) => x * 2, [level])
    const { get } = run()
    assert.equal(get(doubled), 2)
})

test('set() with a calc node as value', () => {
    const level = state(3)
    const { get, send } = run()
    send(set(level, add(level, 1)))
    assert.equal(get(level), 4)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Comparison calcs
// ═══════════════════════════════════════════════════════════════════════════════

test('eq: returns true when values are strictly equal', () => {
    const a = state(5)
    const { get } = run()
    assert.equal(get(eq(a, 5)), true)
    assert.equal(get(eq(a, 6)), false)
})

test('neq: returns true when values differ', () => {
    const a = state(5)
    const { get } = run()
    assert.equal(get(neq(a, 5)), false)
    assert.equal(get(neq(a, 6)), true)
})

test('lt / lte: less-than comparisons', () => {
    const a = state(3)
    const { get } = run()
    assert.equal(get(lt(a, 5)), true)
    assert.equal(get(lt(a, 3)), false)
    assert.equal(get(lte(a, 3)), true)
    assert.equal(get(lte(a, 2)), false)
})

test('gt / gte: greater-than comparisons', () => {
    const a = state(7)
    const { get } = run()
    assert.equal(get(gt(a, 5)), true)
    assert.equal(get(gt(a, 7)), false)
    assert.equal(get(gte(a, 7)), true)
    assert.equal(get(gte(a, 8)), false)
})

test('eq works with string state', () => {
    const phase = state('start')
    const { get } = run()
    assert.equal(get(eq(phase, 'start')), true)
    assert.equal(get(eq(phase, 'end')), false)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Arithmetic calcs
// ═══════════════════════════════════════════════════════════════════════════════

test('add: sums two nodes', () => {
    const a = state(3)
    const b = state(4)
    const { get } = run()
    assert.equal(get(add(a, b)), 7)
})

test('sub: subtracts two nodes', () => {
    const a = state(10)
    const b = state(3)
    const { get } = run()
    assert.equal(get(sub(a, b)), 7)
})

test('mul: multiplies two nodes', () => {
    const a = state(6)
    const b = state(7)
    const { get } = run()
    assert.equal(get(mul(a, b)), 42)
})

test('div: divides two nodes', () => {
    const a = state(15)
    const b = state(3)
    const { get } = run()
    assert.equal(get(div(a, b)), 5)
})

test('mod: remainder', () => {
    const a = state(17)
    const { get } = run()
    assert.equal(get(mod(a, 5)), 2)
})

test('pow: exponentiation', () => {
    const a = state(2)
    const { get } = run()
    assert.equal(get(pow(a, 10)), 1024)
})

test('neg: negates a node', () => {
    const a = state(5)
    const { get } = run()
    assert.equal(get(neg(a)), -5)
})

test('abs: absolute value', () => {
    const a = state(-42)
    const { get } = run()
    assert.equal(get(abs(a)), 42)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Aggregation calcs
// ═══════════════════════════════════════════════════════════════════════════════

test('sum: adds any number of nodes', () => {
    const a = state(1)
    const b = state(2)
    const c = state(3)
    const { get } = run()
    assert.equal(get(sum(a, b, c)), 6)
})

test('sum with a single arg', () => {
    const a = state(7)
    const { get } = run()
    assert.equal(get(sum(a)), 7)
})

test('min: returns the smallest', () => {
    const a = state(3)
    const b = state(1)
    const c = state(2)
    const { get } = run()
    assert.equal(get(min(a, b, c)), 1)
})

test('max: returns the largest', () => {
    const a = state(3)
    const b = state(1)
    const c = state(5)
    const { get } = run()
    assert.equal(get(max(a, b, c)), 5)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Logic calcs
// ═══════════════════════════════════════════════════════════════════════════════

test('not: inverts truthiness', () => {
    const a = state(true)
    const b = state(false)
    const { get } = run()
    assert.equal(get(not(a)), false)
    assert.equal(get(not(b)), true)
})

test('not of a calc node', () => {
    const a = state(5)
    const { get } = run()
    assert.equal(get(not(gt(a, 10))), true)
    assert.equal(get(not(gt(a, 3))), false)
})

test('and: true only when all are truthy', () => {
    const a = state(true)
    const b = state(true)
    const c = state(false)
    const { get } = run()
    assert.equal(get(and(a, b)), true)
    assert.equal(get(and(a, b, c)), false)
})

test('or: true when at least one is truthy', () => {
    const a = state(false)
    const b = state(false)
    const c = state(true)
    const { get } = run()
    assert.equal(get(or(a, b)), false)
    assert.equal(get(or(a, b, c)), true)
})

// ═══════════════════════════════════════════════════════════════════════════════
// String calcs
// ═══════════════════════════════════════════════════════════════════════════════

test('concat: joins string nodes', () => {
    const first = state('Hello')
    const second = state(', world!')
    const { get } = run()
    assert.equal(get(concat(first, second)), 'Hello, world!')
})

test('concat with literal mixed in', () => {
    const name = state('Alice')
    const { get } = run()
    assert.equal(get(concat('Hello, ', name, '!')), 'Hello, Alice!')
})

// ═══════════════════════════════════════════════════════════════════════════════
// Composition: calc chains
// ═══════════════════════════════════════════════════════════════════════════════

test('deeply chained arithmetic', () => {
    const a = state(2)
    const b = state(3)
    // ((a + b) * (a + b)) - b = 25 - 3 = 22
    const apb = add(a, b)
    const { get } = run()
    assert.equal(get(sub(mul(apb, apb), b)), 22)
})

test('comparison chain: clamp-like logic', () => {
    const value = state(15)
    const lo = state(0)
    const hi = state(10)
    // max(lo, min(value, hi)) → clamp
    const clamped = max(lo, min(value, hi))
    const { get } = run()
    assert.equal(get(clamped), 10)
})

test('calc chains work (sum of sums)', () => {
    const a = state(1)
    const b = state(2)
    const c = state(3)
    const { get } = run()
    assert.equal(get(sum(sum(a, b), c)), 6)
})

test('logic composed from comparisons', () => {
    const score = state(8)
    const lives = state(0)
    // game over when score < 10 AND lives == 0
    const gameOver = and(lt(score, 10), eq(lives, 0))
    const { get } = run()
    assert.equal(get(gameOver), true)
})

// ═══════════════════════════════════════════════════════════════════════════════
// iff: conditional transitions
// ═══════════════════════════════════════════════════════════════════════════════

test('iff: matches first condition group', () => {
    const phase = state('start')
    const action = iff([eq(phase, 'start')])([set(phase, 'middle')])
    const { get, send } = run()
    send(action)
    assert.equal(get(phase), 'middle')
})

test('iff: skips unmatched first group, matches second', () => {
    const phase = state('middle')
    const action = iff(
        [eq(phase, 'start')],
        [eq(phase, 'middle')],
    )([set(phase, 'middle')], [set(phase, 'end')])
    const { get, send } = run()
    send(action)
    assert.equal(get(phase), 'end')
})

test('iff: no match → no-op', () => {
    const phase = state('end')
    const score = state(3)
    const action = iff([eq(phase, 'end'), gt(score, 5)])([set(phase, 'start')])
    const { get, send } = run()
    send(action)
    assert.equal(get(phase), 'end')
})

test('iff: outputs can be arrays of Update nodes', () => {
    const score = state(10)
    const level = state(1)
    const phase = state('end')
    const target = state(5)
    const action = iff(
        [eq(phase, 'end'), gt(score, target)],
    )([set(score, 0), set(phase, 'start'), set(level, add(level, 1))])
    const { get, send } = run()
    send(action)
    assert.equal(get(phase), 'start')
    assert.equal(get(score), 0)
    assert.equal(get(level), 2)
})

test('iff as value-selector (not action)', () => {
    const level = state(1)
    const target = iff([eq(level, 1)])(5, 10)
    const { get } = run()
    assert.equal(get(target), 5)
})

test('iff value-selector flips when dep changes', () => {
    const level = state(1)
    const target = iff([eq(level, 1)])(5, 10)
    const { get, send } = run()
    assert.equal(get(target), 5)
    send(set(level, 2))
    assert.equal(get(target), 10)
})

// ═══════════════════════════════════════════════════════════════════════════════
// iff composed with calc helpers
// ═══════════════════════════════════════════════════════════════════════════════

test('iff condition using gt and and', () => {
    const hp = state(50)
    const maxHp = state(100)
    const alive = and(gt(hp, 0), lte(hp, maxHp))
    const status = iff([alive])('alive', 'dead')
    const { get, send } = run()
    assert.equal(get(status), 'alive')
    send(set(hp, 0))
    assert.equal(get(status), 'dead')
})

test('iff action conditioned on neg: score below zero', () => {
    const score = state(-5)
    const reset = iff([lt(score, 0)])([set(score, 0)])
    const { get, send } = run()
    send(reset)
    assert.equal(get(score), 0)
})

test('iff with multi-state condition group: all must be truthy', () => {
    const a = state(true)
    const b = state(false)
    const x = state(0)
    const action = iff([a, b])([set(x, 1)])
    const { get, send } = run()
    send(action)
    assert.equal(get(x), 0) // b is false → no match
})

// ═══════════════════════════════════════════════════════════════════════════════
// Full game-loop example
// ═══════════════════════════════════════════════════════════════════════════════

test('full game-loop example', () => {
    const score = state(0)
    const level = state(1)
    const phase = state('start')

    const resetScore = set(score, 0)
    const nextLevel = set(level, add(level, 1))
    const target = iff([eq(level, 1)])(5, 10)
    const setScore = (amount: number) => set(score, amount)

    const next = iff(
        [eq(phase, 'start')],
        [eq(phase, 'middle')],
        [eq(phase, 'end'), gt(score, target)],
    )(
        [set(phase, 'middle')],
        [set(phase, 'end')],
        [resetScore, set(phase, 'start'), nextLevel],
    )

    const { send, get } = run()

    assert.equal(get(level), 1, 'initial level')
    assert.equal(get(phase), 'start', 'initial phase')

    send(next)
    assert.equal(get(phase), 'middle', 'after 1st next: middle')

    send(next)
    assert.equal(get(phase), 'end', 'after 2nd next: end')

    send(next)
    assert.equal(get(phase), 'end', 'score too low: still end')

    send(setScore(15))
    send(next)
    assert.equal(get(phase), 'start', 'back to start')
    assert.equal(get(level), 2, 'level incremented')
    assert.equal(get(score), 0, 'score reset')
})

// ═══════════════════════════════════════════════════════════════════════════════
// watch()
// ═══════════════════════════════════════════════════════════════════════════════

test('watch() fires when a watched dep changes', () => {
    const level = state(1)
    const { send, watch } = run()
    const log: number[] = []
    watch((lvl: number) => log.push(lvl), [level])
    send(set(level, 2))
    send(set(level, 3))
    assert.deepEqual(log, [2, 3])
})

test('watch() does NOT fire when an unrelated state changes', () => {
    const score = state(0)
    const level = state(1)
    const { send, watch } = run()
    const log: number[] = []
    watch((lvl: number) => log.push(lvl), [level])
    send(set(score, 99))
    assert.deepEqual(log, [])
    send(set(level, 5))
    assert.deepEqual(log, [5])
})

test('watch() returns an unsubscribe function', () => {
    const level = state(1)
    const { send, watch } = run()
    const log: number[] = []
    const unsub = watch((lvl: number) => log.push(lvl), level)
    send(set(level, 2))
    unsub()
    send(set(level, 3))
    send(set(level, 4))
    assert.deepEqual(log, [2])
})

test('watch() fires when watching a calc node', () => {
    const score = state(0)
    const doubled = mul(score, 2)
    const { send, watch } = run()
    const log: number[] = []
    watch((d: number) => log.push(d), [doubled])
    send(set(score, 5))
    send(set(score, 10))
    assert.deepEqual(log, [10, 20])
})

test('watch() silent when calc value is stable despite dep change', () => {
    const a = state(2)
    const b = state(3)
    const product = mul(a, b)
    const { send, watch } = run()
    const log: number[] = []
    watch((p: number) => log.push(p), [product])
    send([set(a, 1), set(b, 6)]) // product stays 6
    assert.deepEqual(log, [])
})

test('watch() fires when watching an iff value-selector node', () => {
    const level = state(1)
    const target = iff([eq(level, 1)])(5, 10)
    const { send, watch } = run()
    const log: number[] = []
    watch((t: number) => log.push(t), [target])
    send(set(level, 2))
    assert.deepEqual(log, [10])
})

test('watch() watches a composed logic calc', () => {
    const hp = state(100)
    const alive = gt(hp, 0)
    const { send, watch } = run()
    const log: boolean[] = []
    watch((v: boolean) => log.push(v), [alive])
    send(set(hp, 50))
    assert.deepEqual(log, []) // still true — no change
    send(set(hp, 0))
    assert.deepEqual(log, [false])
})

test('watch() with initial dep value of undefined', () => {
    const x = state<number | undefined>(undefined)
    const { send, watch } = run()
    const log: unknown[] = []
    watch((val: number | undefined) => log.push(val), [x])
    send(set(x, 42))
    assert.deepEqual(log, [42])
})

// ═══════════════════════════════════════════════════════════════════════════════
// Atomicity: snapshot-before-write
// ═══════════════════════════════════════════════════════════════════════════════

test('send: two mutations in one send use pre-send state', () => {
    const x = state(10)
    const y = state(0)
    const { get, send } = run()
    send([set(x, add(x, 5)), set(y, add(x, 3))])
    assert.equal(get(x), 15)
    assert.equal(get(y), 13) // pre-send x=10, not post-write x=15
})

test('nextLevel applied twice increments correctly', () => {
    const level = state(1)
    const nextLevel = set(level, add(level, 1))
    const { get, send } = run()
    send(nextLevel)
    send(nextLevel)
    assert.equal(get(level), 3)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Calc memoisation
// ═══════════════════════════════════════════════════════════════════════════════

test('calc fn is not called again when deps unchanged', () => {
    const a = state(1)
    let callCount = 0
    const doubled = calc((x: number) => { callCount++; return x * 2 }, [a])
    const { get } = run()
    get(doubled)
    get(doubled)
    get(doubled)
    assert.equal(callCount, 1)
})

test('calc fn is re-called after a dep changes', () => {
    const a = state(1)
    let callCount = 0
    const doubled = calc((x: number) => { callCount++; return x * 2 }, [a])
    const { get, send } = run()
    get(doubled)
    send(set(a, 5))
    const result = get(doubled)
    get(doubled)
    assert.equal(callCount, 2)
    assert.equal(result, 10)
})

test('calc cache: sum helper is memoised', () => {
    const a = state(2)
    const b = state(3)
    const { get, send } = run()
    const s = sum(a, b)
    assert.equal(get(s), 5)
    assert.equal(get(s), 5) // no re-compute
    send(set(a, 10))
    assert.equal(get(s), 13) // recomputed with new dep
})

// ═══════════════════════════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════════════════════════

test('calc cache hits correctly when dep is NaN', () => {
    const x = state(NaN)
    let calls = 0
    const check = calc((v: number) => { calls++; return Number.isNaN(v) }, [x])
    const { get } = run()
    get(check)
    get(check)
    assert.equal(calls, 1)
})

test('watcher does not fire when state stays NaN', () => {
    const x = state(NaN)
    const { send, watch } = run()
    const log: unknown[] = []
    watch((v: number) => log.push(v), [x])
    send(set(x, NaN))
    assert.deepEqual(log, [])
})

test('unsubscribing inside a callback does not skip other watchers', () => {
    const x = state(0)
    const { send, watch } = run()
    const log: string[] = []
    let unsubA!: () => void
    unsubA = watch(() => { unsubA() }, [x])
    watch(() => log.push('B'), [x])
    send(set(x, 1))
    assert.deepEqual(log, ['B'])
})

test('send resolves nested iff-returning-iff', () => {
    const phase = state('start')
    const alive = state(true)
    const advance = set(phase, 'middle')
    const gameOver = set(phase, 'over')
    const next: Action = iff([eq(phase, 'start')])(
        iff([eq(alive, true)])(advance, gameOver),
        set(phase, 'end'),
    )
    const { get, send } = run()
    send(next)
    assert.equal(get(phase), 'middle')
})

test('multiple independent runtimes share no state', () => {
    const score = state(0)
    const r1 = run()
    const r2 = run()
    r1.send(set(score, 42))
    assert.equal(r1.get(score), 42)
    assert.equal(r2.get(score), 0) // r2 is untouched
})

test('abs on a derived neg value', () => {
    const a = state(10)
    const b = state(15)
    // |a - b| = 5
    const dist = abs(sub(a, b))
    const { get } = run()
    assert.equal(get(dist), 5)
})

test('min/max clamp: clamps value between bounds', () => {
    const value = state(25)
    const lo = state(0)
    const hi = state(20)
    const clamped = max(lo, min(value, hi))
    const { get, send } = run()
    assert.equal(get(clamped), 20) // value > hi → clamped to hi
    send(set(value, -5))
    assert.equal(get(clamped), 0)  // value < lo → clamped to lo
    send(set(value, 10))
    assert.equal(get(clamped), 10) // within range → unchanged
})

test('or / and composed: (a > 5) or (b < 2)', () => {
    const a = state(3)
    const b = state(10)
    const result = or(gt(a, 5), lt(b, 2))
    const { get, send } = run()
    assert.equal(get(result), false)
    send(set(a, 6))
    assert.equal(get(result), true)
})

test('list() fluent API works', () => {
    const { get, send } = run()
    const items = list(['a', 'b'])

    assert.deepEqual(get(items), ['a', 'b'])
    assert.equal(get(items.length()), 2)
    assert.equal(get(items.at(0)), 'a')
    assert.equal(get(items.includes('b')), true)

    send(items.push('c'))
    assert.deepEqual(get(items), ['a', 'b', 'c'])

    send(items.pop())
    assert.deepEqual(get(items), ['a', 'b'])

    send(items.remove('a'))
    assert.deepEqual(get(items), ['b'])

    send(items.reset())
    assert.deepEqual(get(items), ['a', 'b'])
})

test('iff uses not() for inverted condition', () => {
    const active = state(false)
    const label = iff([not(active)])('inactive', 'active')
    const { get, send } = run()
    assert.equal(get(label), 'inactive')
    send(set(active, true))
    assert.equal(get(label), 'active')
})

test('iff shorthand: supports single condition without array wrapper', () => {
    const level = state(1)
    const target = iff(eq(level, 1))(5, 10)
    const { get, send } = run()
    assert.equal(get(target), 5)
    send(set(level, 2))
    assert.equal(get(target), 10)
})

test('set value derived from min/max', () => {
    const hp = state(120)
    const maxHp = state(100)
    const { get, send } = run()
    // clamp hp to maxHp on level-up
    send(set(hp, min(hp, maxHp)))
    assert.equal(get(hp), 100)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Type smoke tests: Val<T> and Action used as annotations
// ═══════════════════════════════════════════════════════════════════════════════

test('Val<T> accepts atoms, calcs, iff nodes, and plain values', () => {
    const a = state(1)
    const b = calc((x: number) => x + 1, [a])
    const c = iff([eq(a, 1)])(10, 20)
    const { get } = run()
    const vals: Val<number>[] = [a, b, c, 42]
    assert.deepEqual(vals.map(v => get(v)), [1, 2, 10, 42])
})

test('Action accepts Update, Iff, and nested arrays', () => {
    const x = state(0)
    const y = state(0)
    const { get, send } = run()
    const action: Action = [set(x, 1), iff([eq(x, 0)])([set(y, 99)])]
    send(action)
    assert.equal(get(x), 1)
    // x was 0 at resolution time → iff matched
    assert.equal(get(y), 99)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Fluent API (ext.ts)
// ═══════════════════════════════════════════════════════════════════════════════

test('num() fluent API works', () => {
    const { get, send } = run()
    const score = num(10)
    assert.equal(get(score), 10)
    send(score.set(20))
    assert.equal(get(score), 20)
    assert.equal(get(score.add(5)), 25)
    assert.equal(get(score.lt(30)), true)
})

test('text() and includes fluency', () => {
    const { get } = run()
    const title = text('hello there')
    assert.equal(get(title.includes('hello')), true)
    assert.equal(get(title.includes('world')), false)
})

test('choice() setTo/is/isNot work as separate objects', () => {
    const { get, send } = run()
    const phase = choice('idle', 'running')

    // is/isNot property access
    assert.equal(get(phase.is.idle), true)
    assert.equal(get(phase.isNot.idle), false)

    // Standard eq/neq function calls
    assert.equal(get(phase.eq('running')), false)

    // setTo usage
    send(phase.setTo.running)
    assert.equal(get(phase.is.running), true)

    // set() function usage
    send(phase.set('idle'))
    assert.equal(get(phase.is.idle), true)
})

test('num() inc/dec, clamp and reset()', () => {
    const { get, send } = run()
    const n = num(10)

    send(n.inc())
    assert.equal(get(n), 11)

    send(n.dec())
    assert.equal(get(n), 10)

    assert.equal(get(n.clamp(0, 5)), 5)

    send(n.set(100))
    send(n.reset())
    assert.equal(get(n), 10)
})

test('choice() (enum) fluent API with setTo and is', () => {
    const { get, send } = run()
    const phase = choice('idle', 'running', 'finished')

    assert.equal(get(phase.is.idle), true)
    assert.equal(get(phase.is.running), false)

    send(phase.setTo.running)
    assert.equal(get(phase.is.idle), false)
    assert.equal(get(phase.is.running), true)
})

test('User example: combined fluent logic with setTo and is', () => {
    const { get, send } = run()
    const phase = choice('idle', 'running', 'finished')
    const score = num(0)

    const next = iff([phase.is.idle, score.lt(100)])([
        phase.setTo.running,
        score.set(50)
    ])

    send(next)
    assert.equal(get(phase), 'running')
    assert.equal(get(score), 50)
})

test('record() fluent API', () => {
    const { get, send } = run()
    const user = record({ name: 'Alice', age: 25 })

    assert.equal(get(user.at('name')), 'Alice')
    assert.deepEqual(get(user), { name: 'Alice', age: 25 })

    send(user.put('name', 'Bob'))
    assert.equal(get(user.at('name')), 'Bob')

    send(user.patch({ age: 30 }))
    assert.deepEqual(get(user), { name: 'Bob', age: 30 })
})

test('collection() fluent API', () => {
    const { get, send } = run()
    const tags = collection(['red', 'blue'])

    assert.equal(get(tags.size()), 2)
    assert.equal(get(tags.has('red')), true)

    send(tags.add('green'))
    assert.equal(get(tags.size()), 3)

    send(tags.add('red')) // already exists
    assert.equal(get(tags.size()), 3)

    send(tags.remove('blue'))
    assert.equal(get(tags.size()), 2)
    assert.equal(get(tags.has('blue')), false)

    send(tags.clear())
    assert.equal(get(tags.size()), 0)
})

test('num() floor, ceil, round', () => {
    const { get } = run()
    const n = num(10.5)
    assert.equal(get(n.floor()), 10)
    assert.equal(get(n.ceil()), 11)
    assert.equal(get(n.round()), 11)
})

test('text() manipulation methods', () => {
    const { get, send } = run()
    const msg = text('  Hello World  ')

    assert.equal(get(msg.trim()), 'Hello World')
    assert.equal(get(msg.toUpper()), '  HELLO WORLD  ')
    assert.equal(get(msg.toLower()), '  hello world  ')
    assert.deepEqual(get(text('A B').split(' ')), ['A', 'B'])
    assert.equal(get(text('ABC').slice(0, 2)), 'AB')
    assert.equal(get(text('Hello').replace('H', 'J')), 'Jello')
    assert.equal(get(text('Hello').startsWith('H')), true)
    assert.equal(get(text('Hello').endsWith('o')), true)
})

test('list() functional methods', () => {
    const { get } = run()
    const items = list([1, 2, 3])

    assert.deepEqual(get(items.map(x => x * 2)), [2, 4, 6])
    assert.deepEqual(get(items.filter(x => x > 1)), [2, 3])
    assert.equal(get(items.reduce((a, b) => a + b, 10)), 16)
    assert.equal(get(items.find(x => x > 2)), 3)
    assert.equal(get(items.some(x => x === 2)), true)
    assert.equal(get(items.every(x => x > 0)), true)
    assert.deepEqual(get(items.intersect([2, 3, 4])), [2, 3])
})

test('collection() set operations', () => {
    const { get } = run()
    const a = collection(['red', 'blue'])
    const b = ['blue', 'green']

    assert.deepEqual(get(a.intersect(b)), ['blue'])
    assert.deepEqual(get(a.union(b)), ['red', 'blue', 'green'])
    assert.deepEqual(get(a.difference(b)), ['red'])
})

test('record() functional views', () => {
    const { get } = run()
    const user = record({ name: 'Alice', age: 25 })

    assert.deepEqual(get(user.keys()), ['name', 'age'])
    assert.deepEqual(get(user.values()), ['Alice', 25])
    assert.deepEqual(get(user.entries()), [['name', 'Alice'], ['age', 25]])
})

// ═══════════════════════════════════════════════════════════════════════════════
// Architectural: Selective Watchers & Safety
// ═══════════════════════════════════════════════════════════════════════════════

test('resolve: throws on direct circular dependency', () => {
    const { get } = run()
    const a: any = calc(() => get(a), [])
    assert.throws(() => get(a), /Circular dependency/)
})

test('resolve: throws on indirect circular dependency', () => {
    const { get } = run()
    const a: any = calc(() => get(b), [])
    const b: any = calc(() => get(a), [])
    assert.throws(() => get(a), /Circular dependency/)
})

test('watch: tracks atoms deeply through calc nodes', () => {
    const a = state(1)
    const b = state(2)
    const sumVal = calc((x, y) => x + y, [a, b])
    const doubled = calc(s => s * 2, [sumVal])

    const { send, watch } = run()
    let count = 0
    watch(() => count++, [doubled])

    send(set(a, 10)) // Should trigger
    assert.equal(count, 1)

    send(set(b, 20)) // Should trigger
    assert.equal(count, 2)
})

test('watch: does NOT fire for unrelated atoms (granular index test)', () => {
    const active = state(true)
    const score = state(0)
    const isReady = eq(active, true)

    const { send, watch } = run()
    let fireCount = 0
    watch(() => fireCount++, [isReady])

    send(set(score, 100)) // Change UNRELATED atom
    assert.equal(fireCount, 0) // Should NOT have fired

    send(set(active, false)) // Change RELATED atom
    assert.equal(fireCount, 1) // Should have fired
})

test('watch: tracks atoms through iff nodes', () => {
    const loggedIn = state(false)
    const role = state('guest')

    const view = iff([loggedIn])(role, 'pls login')

    const { send, watch } = run()
    let count = 0
    watch(() => count++, [view])

    send(set(loggedIn, true)) // Logic change: pls login -> guest
    assert.equal(count, 1)

    send(set(role, 'admin')) // Dependency change in the matched branch
    assert.equal(count, 2)
})

test('immutability: prevents direct mutation of state objects', () => {
    const config = state({ volume: 50, nested: { value: 1 } })
    const { get } = run()
    const data = get(config)

    // Should be frozen
    assert.equal(Object.isFrozen(data), true)
    assert.equal(Object.isFrozen(data.nested), true)

    // In strict mode (which tests run in), this should throw
    assert.throws(() => {
        (data as any).volume = 100
    }, TypeError)

    assert.throws(() => {
        (data as any).nested.value = 2
    }, TypeError)

    assert.equal(data.volume, 50)
})

// ═══════════════════════════════════════════════════════════════════════════════
// Runtime on()
// ═══════════════════════════════════════════════════════════════════════════════

test('on() activates immediately when condition is already true', () => {
    const light = choice('red', 'green')
    const { on } = run()
    let runs = 0

    on(light.is.red)(() => {
        runs++
    })

    assert.equal(runs, 1)
})

test('on() runs once on enter and cleans up once on exit', () => {
    const active = bool(false)
    const score = num(0)
    const { send, on } = run()
    let runs = 0
    let cleans = 0

    on(active)(() => {
        runs++
        return () => {
            cleans++
        }
    })

    send(active.set(true))
    send(score.set(1))
    send(score.set(2))
    send(active.set(false))

    assert.equal(runs, 1)
    assert.equal(cleans, 1)
})

test('on() handlers run after atomic send updates are committed', () => {
    const armed = bool(false)
    const x = num(10)
    const y = num(0)
    const seen: number[] = []
    const { get, send, on } = run()

    on(armed)(() => {
        seen.push(get(y))
    })

    send([armed.set(true), y.set(x.add(3))])

    assert.deepEqual(seen, [13])
})

test('on() supports arrays of conditions as an AND group', () => {
    const active = bool(false)
    const ready = bool(false)
    const { send, on } = run()
    let runs = 0

    on([active, ready])(() => {
        runs++
    })

    send(active.set(true))
    assert.equal(runs, 0)

    send(ready.set(true))
    assert.equal(runs, 1)

    send(active.set(false))
    send(active.set(true))
    assert.equal(runs, 2)
})

test('on() array conditions clean up when one member exits', () => {
    const active = bool(false)
    const ready = bool(false)
    const { send, on } = run()
    let cleans = 0
    let exits = 0

    on([active, ready])(() => {
        return () => {
            cleans++
        }
    }).exit(() => {
        exits++
    })

    send([active.set(true), ready.set(true)])
    send(active.set(false))

    assert.equal(cleans, 1)
    assert.equal(exits, 1)
})

test('watch() accepts a single dep without an array', () => {
    const active = bool(false)
    const { send, watch } = run()
    const seen: boolean[] = []

    watch((value: boolean) => {
        seen.push(value)
    }, active)

    send(active.set(true))
    assert.deepEqual(seen, [true])
})

test('watch() accepts a single calc dep without an array', () => {
    const score = num(1)
    const doubled = score.mul(2)
    const { send, watch } = run()
    const seen: number[] = []

    watch((value: number) => {
        seen.push(value)
    }, doubled)

    send(score.set(3))
    assert.deepEqual(seen, [6])
})

test('on() returns an unsubscribe function', () => {
    const active = bool(true)
    const { send, on } = run()
    let runs = 0
    let cleans = 0

    const unon = on(active)(() => {
        runs++
        return () => {
            cleans++
        }
    })

    assert.equal(runs, 1)
    unon()
    assert.equal(cleans, 1)

    send(active.set(false))
    send(active.set(true))
    assert.equal(runs, 1)
})

test('on().exit() runs when the condition exits after entry', () => {
    const active = bool(false)
    const { send, on } = run()
    let exits = 0

    on(active)(() => undefined).exit(() => {
        exits++
    })

    send(active.set(true))
    send(active.set(false))
    send(active.set(false))

    assert.equal(exits, 1)
})

test('on().exit() does not run during manual unsubscribe', () => {
    const active = bool(true)
    const { on } = run()
    let exits = 0

    const unon = on(active)(() => undefined).exit(() => {
        exits++
    })

    unon()

    assert.equal(exits, 0)
})

test('on() registrations are independently removable', () => {
    const active = bool(true)
    const debug = bool(false)
    const { send, on } = run()
    let cleans = 0
    let debugRuns = 0

    const stopActive = on(active)(() => () => {
        cleans++
    })

    on(debug)(() => {
        debugRuns++
    })

    stopActive()
    send(debug.set(true))

    assert.equal(cleans, 1)
    assert.equal(debugRuns, 1)
})

test('on() handles nested sends triggered during enter reconciliation', () => {
    const active = bool(false)
    const ready = bool(false)
    const { send, on } = run()
    let readyRuns = 0

    on(active)(() => {
        send(ready.set(true))
    })

    on(ready)(() => {
        readyRuns++
    })

    send(active.set(true))

    assert.equal(readyRuns, 1)
})

test('trace() logs watched values and returns an unsubscribe function', () => {
    const score = num(0)
    const logs: unknown[][] = []
    const runtime = run()

    const untrace = trace(runtime, [score, score.add(1)], {
        label: 'score',
        logger: (...args) => logs.push(args),
    })

    runtime.send(score.set(2))
    untrace()
    runtime.send(score.set(3))

    assert.deepEqual(logs, [['[sac:score]', 2, 3]])
})

test('traceSend() logs actions before sending them', () => {
    const score = num(0)
    const logs: unknown[][] = []
    const runtime = run()
    const send = traceSend(runtime, {
        label: 'actions',
        logger: (...args) => logs.push(args),
    })

    send(score.set(4))

    assert.equal(runtime.get(score), 4)
    assert.equal(logs.length, 1)
    assert.equal(logs[0][0], '[sac:actions]')
    assert.deepEqual(logs[0][1], score.set(4))
})
