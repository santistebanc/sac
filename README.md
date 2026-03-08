# sac

**S**tate · **A**ctions · **C**omputations

A tiny, declarative state library for TypeScript. Define atoms, derive computed values, express conditional transitions, and reactively watch changes — all as composable, plain data structures with no magic.

## Key Features

- **Granular Reactivity**: High-performance dependency tracking indexes atoms to minimize work.
- **Deep Immutability**: Built-in protection prevents direct state corruption via `deepFreeze`.
- **Circular Safety**: Detects and throws on circular calculation dependencies.
- **Fluent & Functional**: Choose between snappy fluent atoms (`num`, `bool`, `choice`) or pure data-driven functions.
- **Zero-Cost Abstraction**: Minimal runtime overhead and tiny bundle size (< 2kb).

---

## Contents

- [Quick start](#quick-start)
- [Fluent API](#fluent-api)
  - [num()](#num)
  - [text()](#text)
  - [bool()](#bool)
  - [list()](#list)
  - [choice()](#choice)
- [Core API](#core-api)
  - [state()](#state)
  - [calc()](#calc)
  - [set()](#set)
  - [iff()](#iff)
  - [run()](#run)
- [Calc helpers](#calc-helpers)
  - [Comparison](#comparison)
  - [Arithmetic](#arithmetic)
  - [Aggregation](#aggregation)
  - [Logic](#logic)
  - [String](#string)
- [Patterns & recipes](#patterns--recipes)
  - [Derived state](#derived-state)
  - [Conditional transitions](#conditional-transitions)
  - [Multi-atom atomic updates](#multi-atom-atomic-updates)
  - [Reactive watchers](#reactive-watchers)
  - [Composing helpers](#composing-helpers)
  - [Multiple independent runtimes](#multiple-independent-runtimes)
- [Integrations](#integrations)
  - [React](#react)
  - [Vue](#vue)
  - [Svelte](#svelte)
- [How it works](#how-it-works)

---

## Core concepts

sac has four building blocks:

| Concept | Type | What it is |
|---|---|---|
| **`state()`** | `Atom<T>` | A mutable atom — holds a value over time |
| **`calc()`** | `Calc<T>` | A derived value — lazily computed from deps, memoised |
| **`iff()`** | `Iff<T>` | A conditional — resolves to an output based on boolean guards |
| **`set()`** | `Update<T>` | An update — pairs an atom with a new value |

All four are **plain objects**. There is no subscription wiring at definition time. You compose them freely, pass them around as data, and only resolve them when you call `run()`.

---

## Installation

```bash
# Clone the repo
git clone https://github.com/santistebanc/sac

# Or install directly from GitHub
npm install github:santistebanc/sac
```

```json
// tsconfig.json — required flags
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true
  }
}
```
 
---
 
## Quick start
 
```ts
import { num, choice, iff, run } from 'sac'

// 1. Define smart atoms
const score = num(0)
const phase = choice('start', 'playing', 'end')

// 2. Define logic using fluent methods
const isHighScore = score.gt(100)
const win         = score.add(50) 

// 3. Define transitions
const advance = iff(
  phase.is.start,
  [phase.is.playing, isHighScore],
)(
  phase.setTo.playing,
  [phase.setTo.end, score.set(win)],
)

// 4. Create a runtime and interact
const { get, send, watch } = run()

send(advance)           // phase: 'start' -> 'playing'
watch((s) => console.log(`score: ${s}`), [score])
send(score.set(150))    // logs: score: 150
send(advance)           // phase: 'playing' -> 'end'
```

**Note:** While you can use core functions like `state()` and `set()`, the **Fluent API** (`num`, `choice`, etc.) is the recommended way to get the best DX.

---

## Fluent API

Smart constructors that pre-bind helpers to atoms for a more ergonomic DX. All return `Atom<T>` nodes enhanced with methods.

### `num(initial)`
- **Methods:** `.add(v)`, `.sub(v)`, `.mul(v)`, `.div(v)`, `.mod(v)`, `.pow(v)`, `.neg()`, `.abs()`, `.min(v)`, `.max(v)`, `.clamp(lo, hi)`
- **Comparisons:** `.lt(v)`, `.lte(v)`, `.gt(v)`, `.gte(v)`, `.eq(v)`, `.neq(v)`
- **Actions:** `.set(v)`, `.inc()`, `.dec()`, `.reset()`, `.default()`

### `text(initial)`
- **Methods:** `.concat(...args)`, `.includes(search)`
- **Comparisons:** `.eq(v)`, `.neq(v)`
- **Actions:** `.set(v)`, `.reset()`, `.default()`

### `bool(initial)`
- **Methods:** `.not()`, `.and(...args)`, `.or(...args)`
- **Comparisons:** `.eq(v)`, `.neq(v)`
- **Actions:** `.set(v)`, `.toggle()`, `.reset()`, `.default()`

### `list(initial)`
Returns an `Atom<T[]>` with:
- **Methods:** `.at(index)`, `.length()`, `.includes(item)`
- **Actions:** `.push(item)`, `.pop()`, `.remove(item)`, `.set(newList)`, `.reset()`, `.default()`

### `choice(...options)`
Smart enum-like atoms with dedicated namespaces for autocomplete.
- **`.is.<option>`**: `Calc` node checking equality.
- **`.isNot.<option>`**: `Calc` node checking inequality.
- **`.setTo.<option>`**: `Update` node setting the state.
- **`.set(v)`, `.eq(v)`, `.neq(v)`**: Standard functional variants for dynamic values.

```ts
const phase = choice('idle', 'loading', 'done')

send(phase.setTo.loading)
const isActive = phase.is.loading
```

---

## Core API

Under the hood, everything in `sac` is built on these four primitives. You can use them directly for custom logic or when the fluent API doesn't fit.

### `state(initial)`

Creates a mutable atom holding a value of type `T`.

```ts
const count   = state(0)
const name    = state('Alice')
const active  = state(true)
const items   = state<string[]>([])
```

`Atom<T>` is just `{ _type: 'state', initial: T }` — a plain object. No side effects occur at creation.

---

### `calc(fn, deps)`

Creates a node whose value is derived by calling `fn` with the resolved values of `deps`.

```ts
const a = state(3)
const b = state(4)

// hypotenuse: √(a² + b²)
const hyp = calc(
  (x: number, y: number) => Math.sqrt(x ** 2 + y ** 2),
  [a, b],
)

const { get } = run()
get(hyp) // 5
```

`deps` can contain `Atom`s, other `Calc`s, `Iff`s, or plain values. TypeScript infers the argument types of `fn` from the dep tuple automatically.

**Memoisation** — the function is only re-called when at least one dep's resolved value changes (`Object.is` semantics, so `NaN === NaN` correctly).

```ts
let calls = 0
const expensive = calc((x: number) => { calls++; return x * 1000 }, [a])

get(expensive) // calls = 1
get(expensive) // calls = 1 — cached
send(set(a, 5))
get(expensive) // calls = 2 — dep changed
```

---

### `set(atom, value)`

Creates an `Update<T>` — pairs an `Atom` with a new value (which can itself be a node).

```ts
const score = state(0)

set(score, 42)            // write a literal
set(score, add(score, 1)) // write a derived value
```

`Update` nodes are just data. They do nothing until passed to `send()`.

---

### `iff(...conditionGroups)(...outputs)`

A two-stage curried constructor for conditional logic.

```
iff( [cond₁, cond₂, ...], [cond₃, ...], ... )
   ( output₀,              output₁,       fallback )
```

Each condition group is an `AND` of its conditions. Groups are tested left-to-right. The first fully-truthy group selects its corresponding output. If no group matches, the last output (the fallback) is used.

**Shorthand:** If a group contains only one condition, you can omit the array wrapper.

```ts
// Shorthand for single condition
iff(eq(level, 1))(5, 10)

// Array required for multiple conditions (AND)
iff([eq(level, 1), isReady])(5, 10)
```

**As a conditional transition:**

```ts
const phase = state<'idle' | 'running' | 'done'>('idle')

const start = iff([eq(phase, 'idle')])(
  [set(phase, 'running')], // guard matched → run these sets
)

const finish = iff(
  [eq(phase, 'running')],
)([set(phase, 'done')])

const { send, get } = run()
send(start)   // phase → 'running'
send(finish)  // phase → 'done'
```

**As a computed value selector:**

```ts
const level = state(1)

// target score depends on the current level
const target = iff(
  [eq(level, 1)],
  [eq(level, 2)],
)(10, 25, 50) // fallback = 50 for levels > 2

const { get } = run()
get(target) // 10
```

**Nested iff:** outputs can themselves be `Iff` nodes — `send()` recursively resolves them.

```ts
const phase = state('start')
const alive = state(true)

const next = iff([eq(phase, 'start')])(
  iff([alive])(set(phase, 'playing'), set(phase, 'game-over')),
  set(phase, 'done'),
)
```

---

### `run()`

Creates a self-contained runtime. Returns `{ get, send, watch }`.

```ts
const { get, send, watch } = run()
```

Each call to `run()` produces a **completely independent** state store — the same node definitions can be used in multiple runtimes without interference.

#### `get(node)`

Resolves any node (or plain value) to its current value.

```ts
get(score)    // current value of the atom
get(doubled)  // recomputed if deps changed, otherwise cached
get(target)   // iff selects the right branch
get(42)       // plain values pass through
```

#### `send(action)`

Dispatches one or more `Update` nodes, applying all mutations **atomically**:

1. All new values are resolved against the **pre-send** store snapshot (order-independent).
2. All mutations are written.
3. Watchers whose deps changed are notified.

```ts
send(set(x, 1))                      // single set
send([set(x, 1), set(y, 2)])         // batch
send(conditionalAction)               // `Iff` node — branching resolved internally
send([actionA, actionB, conditionalC]) // arrays are flattened recursively
```

#### `watch(fn, deps)`

Registers a callback fired after `send()` whenever any dep's resolved value changes. Returns an unsubscribe function.

```ts
const unsub = watch(
  (score, level) => console.log(`score=${score} level=${level}`),
  [score, level],
)

send(set(score, 10)) // callback fires
unsub()
send(set(score, 20)) // callback is silent
```

`deps` can include `Calc`s and `Iff`s — the watcher fires only when their **resolved output** changes, not merely when an upstream atom changes.

```ts
const doubled = mul(score, 2)
watch((d) => console.log(d), [doubled])

send([set(a, 1), set(b, 6)]) // if product is stable, watcher stays silent
```

---

## Calc helpers

Import everything from the main entry point:

```ts
import { eq, gt, add, sum, not, and, concat, /* ... */ } from 'sac'
```

All helpers return `Calc` nodes. They compose freely — any helper's output can be a dep to another.

### Comparison

| Helper | Signature | Result |
|---|---|---|
| `eq(a, b)` | `Val<unknown> × 2` | `a === b` |
| `neq(a, b)` | `Val<unknown> × 2` | `a !== b` |
| `lt(a, b)` | `Val<number> × 2` | `a < b` |
| `lte(a, b)` | `Val<number> × 2` | `a <= b` |
| `gt(a, b)` | `Val<number> × 2` | `a > b` |
| `gte(a, b)` | `Val<number> × 2` | `a >= b` |

```ts
const health = state(75)
const maxHp  = state(100)

const isHurt    = lt(health, maxHp)
const isFullHp  = eq(health, maxHp)
const isCritial = lte(health, 25)
```

### Arithmetic

| Helper | Result |
|---|---|
| `add(a, b)` | `a + b` |
| `sub(a, b)` | `a - b` |
| `mul(a, b)` | `a * b` |
| `div(a, b)` | `a / b` |
| `mod(a, b)` | `a % b` |
| `pow(a, b)` | `a ** b` |
| `neg(a)` | `-a` |
| `abs(a)` | `Math.abs(a)` |

```ts
const x = state(10)
const y = state(3)

const distance = abs(sub(x, y))   // |x - y| = 7
const area     = mul(x, y)        // 30
const quotient = div(x, y)        // 3.33...
```

### Aggregation

| Helper | Result |
|---|---|
| `sum(...args)` | Sum of all args |
| `min(...args)` | Smallest value |
| `max(...args)` | Largest value |

All three are variadic — pass as many nodes as you need.

```ts
const a = state(3), b = state(7), c = state(2)

const total   = sum(a, b, c)           // 12
const lowest  = min(a, b, c)           // 2
const highest = max(a, b, c)           // 7

// clamp: keep value within [lo, hi]
const value   = state(25)
const lo      = state(0)
const hi      = state(20)
const clamped = max(lo, min(value, hi)) // 20
```

### Logic

| Helper | Result |
|---|---|
| `not(a)` | `!a` |
| `and(...args)` | `true` if all are truthy |
| `or(...args)` | `true` if any is truthy |

```ts
const hp    = state(50)
const armor = state(true)

const alive    = gt(hp, 0)
const defended = and(alive, armor)
const inDanger = or(lt(hp, 20), not(armor))
```

### String

| Helper | Result |
|---|---|
| `concat(...args)` | Joins all args into a string |

```ts
const firstName = state('Ada')
const lastName  = state('Lovelace')

const fullName = concat(firstName, ' ', lastName)

const { get } = run()
get(fullName) // 'Ada Lovelace'
```

---

## Patterns & recipes

### Derived state

Chain helpers to build complex derived values without any intermediate boilerplate:

```ts
const price    = num(9.99)
const quantity = num(3)
const taxRate  = num(0.2)

const subtotal = price.mul(quantity)
const tax      = subtotal.mul(taxRate)
const total    = subtotal.add(tax)

const { get } = run()
get(total) // 35.964
```

### Conditional transitions

Use `iff` to express state machine transitions declaratively:

```ts
const phase   = choice('idle', 'loading', 'success', 'error')
const hasData = bool(false)
const error   = text('')

const next = iff(
  phase.is.idle,
  [phase.is.loading, hasData],
  [phase.is.loading, error.neq('')],
)(
  phase.setTo.loading,
  phase.setTo.success,
  phase.setTo.error,
)

const { send, get } = run()

send(next)                 // idle → loading
send(hasData.set(true))
send(next)                 // loading → success
```

### Multi-atom atomic updates

`send()` resolves all new values **before** writing any of them. Mutations within one send are always consistent with the pre-send state — order doesn't matter.

```ts
const x = num(10)
const y = num(0)

// Both new values are resolved using x=10 (the old value)
send([x.set(x.add(5)), y.set(x.add(3))])

get(x) // 15  (10 + 5)
get(y) // 13  (10 + 3, not 15 + 3)
```

### Reactive watchers

Watch any mix of atoms, `Calc` nodes, and `Iff` selectors. The callback only fires when the **resolved output** actually changes.

```ts
const score = num(0)
const level = num(1)
const rank  = iff(score.gte(100), score.gte(50))('gold', 'silver', 'bronze')

const { send, watch } = run()

watch(
  (s, l, r) => console.log(`Score: ${s} | Level: ${l} | Rank: ${r}`),
  [score, level, rank],
)

send(score.set(60))
// → Score: 60 | Level: 1 | Rank: silver
```

### Composing helpers

Because every helper returns a `Calc`, they nest freely:

```ts
const a = num(3)
const b = num(4)
const c = num(5)

// Pythagorean check: a² + b² === c²
const isPythagorean = a.pow(2).add(b.pow(2)).eq(c.pow(2))

// You can mix functional and fluent styles:
const hyp = calc(
  (x: number, y: number) => Math.sqrt(x ** 2 + y ** 2),
  [a, b],
)
const hyp_gt_c = gt(hyp, c)

const { get } = run()
get(isPythagorean) // true (3² + 4² = 5²)
get(hyp_gt_c)      // false (hyp === c here)
```

### Multiple independent runtimes

Multiple calls to `run()` produce completely isolated stores over the same node definitions:

```ts
const counter = num(0)
const bump    = counter.inc()

const r1 = run()
const r2 = run()

r1.send(bump)
r1.send(bump)
r2.send(bump)

r1.get(counter) // 2
r2.get(counter) // 1
```

This makes it trivial to run isolated test environments, sandboxed UI instances, or server-side per-request stores.

---

## Integrations

`sac` provides official hooks and utilities for popular UI frameworks.

### React

React integration uses `useSyncExternalStore` for optimized, teardown-safe subscriptions.

```tsx
import { SacProvider, useVal, useSend } from 'sac/react'
import { num, run } from 'sac'

const score = num(0)
const runtime = run()

function App() {
  return (
    <SacProvider runtime={runtime}>
      <Counter />
    </SacProvider>
  )
}

function Counter() {
  const value = useVal(score)
  const send = useSend()

  return (
    <button onClick={() => send(score.inc())}>
      Score is: {value}
    </button>
  )
}
```

### Vue

Vue integration provides a `useVal` composable that returns a `shallowRef`.

```ts
import { useVal } from 'sac/vue'
import { score, runtime } from './store'

export default {
  setup() {
    const value = useVal(score, runtime)
    return { value }
  }
}
```

### Svelte

Svelte integration converts any `sac` node into a standard Svelte store.

```html
<script>
  import { toStore } from 'sac/svelte'
  import { score, runtime } from './store'
  
  const scoreStore = toStore(score, runtime)
</script>

<h1>Score is {$scoreStore}</h1>
```

---

## How it works

```
Definition time                Runtime (run())
──────────────────             ────────────────────────────────────
state(0)        ─────────────► store: Map<Atom, any>
calc(fn, deps)  ─────────────► calcCache: WeakMap<Calc, {depValues, result}>
set(atom, val)  ─────────────► collectMuts() → ordered list of `Update` nodes
iff([...])(...) ─────────────► resolve() picks the matching output branch
```

**`resolve(node)`** is the central evaluation engine. It handles:

- `Atom` → reads from the store (falls back to `initial`)
- `Calc` → checks memoisation cache; recomputes if any dep changed
- `Iff` → tests condition groups; returns the matching output
- Plain values/arrays → returned as-is

**`send(action)`** implements a snapshot-then-write protocol:

1. Snapshot resolved dep values for all current watchers.
2. Collect all `Update` nodes from the action (recursing through arrays and `Iff` nodes).
3. Resolve all new values against the **pre-send** snapshot.
4. Write all values to the store.
5. Notify watchers whose dep values changed.

This guarantees atomicity: no mutation within a single `send` can watch the side effects of another mutation in the same `send`.
