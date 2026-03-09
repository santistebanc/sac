# sac

**S**tate · **A**ctions · **C**omputations

A small framework-agnostic TypeScript state library for app logic.

Think of it as:
- lighter than XState
- more structured than Zustand
- usable outside React

Use it when you want:
- simple state primitives
- derived values without boilerplate
- conditional transitions as data
- runtime watchers and enter/exit effects

## Why `sac`

- **Small API**: most apps only need `num`, `text`, `bool`, `choice`, `run`, `send`, `watch`, and `on`
- **Predictable updates**: one `send()` is one atomic state change
- **Derived values by default**: build UI state from state instead of syncing it by hand
- **Useful runtime hooks**: `watch()` for value changes, `on()` for enter/exit effects
- **Framework-friendly**: React, Vue, and Svelte helpers are included

## Good fit

Use `sac` when:
- you want explicit state transitions instead of ad hoc setter code
- you want derived state without manually syncing extra fields
- you want app logic that can be reused across React, Vue, or Svelte
- you want something lighter than a full statechart library

Skip it when:
- you need a large middleware or plugin ecosystem
- you need full hierarchical or parallel statecharts
- you want server-cache/data-fetching features built into the state library

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
  - [Lifecycle effects](#lifecycle-effects)
  - [Debounced search](#debounced-search)
  - [Autosave form](#autosave-form)
  - [Polling while loading](#polling-while-loading)
  - [Auth or session ready](#auth-or-session-ready)
  - [WebSocket subscription](#websocket-subscription)
  - [Debugging](#debugging)
  - [Composing helpers](#composing-helpers)
  - [Multiple independent runtimes](#multiple-independent-runtimes)
- [Examples](#examples)
- [Integrations](#integrations)
  - [React](#react)
  - [Vue](#vue)
  - [Svelte](#svelte)
- [How it works](#how-it-works)

---

## Mental model

Most of `sac` is built from four plain objects:

| Concept | Type | What it is |
|---|---|---|
| **`state()`** | `Atom<T>` | A mutable atom — holds a value over time |
| **`calc()`** | `Calc<T>` | A derived value — lazily computed from deps, memoised |
| **`iff()`** | `Iff<T>` | A conditional — resolves to an output based on boolean guards |
| **`set()`** | `Update<T>` | An update — pairs an atom with a new value |

They do nothing on their own. You compose them first, then a runtime created with `run()` evaluates them.

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
import { text, choice, iff, run } from 'sac'

const name = text('')
const status = choice('idle', 'saving', 'saved', 'error')

const canSave = name.neq('')

const saveProfile = iff([canSave, status.isNot.saving])(
  status.setTo.saving,
)

const { get, send, watch, on } = run()

watch((nextStatus) => {
  console.log('status:', nextStatus)
}, status)

on(status.is.saving)(() => {
  const id = setTimeout(() => send(status.setTo.saved), 800)
  return () => clearTimeout(id)
})

send(name.set('Ada'))
send(saveProfile)

get(status) // 'saving' -> later 'saved'
```

If you prefer the lower-level API, you can use `state()`, `calc()`, and `set()` directly. For most app code, the fluent API is easier to read.

---

## Fluent API

Smart constructors that pre-bind helpers to atoms for a more ergonomic DX. All return `Atom<T>` nodes enhanced with methods.

### `num(initial)`
- **Read:** `.add(v)`, `.sub(v)`, `.mul(v)`, `.div(v)`, `.mod(v)`, `.pow(v)`, `.neg()`, `.abs()`, `.min(v)`, `.max(v)`, `.clamp(lo, hi)`
- **Compare:** `.lt(v)`, `.lte(v)`, `.gt(v)`, `.gte(v)`, `.eq(v)`, `.neq(v)`
- **Write:** `.set(v)`, `.inc()`, `.dec()`, `.reset()`

### `text(initial)`
- **Read:** `.concat(...args)`, `.includes(search)`
- **Compare:** `.eq(v)`, `.neq(v)`
- **Write:** `.set(v)`, `.reset()`

### `bool(initial)`
- **Read:** `.not()`, `.and(...args)`, `.or(...args)`
- **Compare:** `.eq(v)`, `.neq(v)`
- **Write:** `.set(v)`, `.toggle()`, `.reset()`

### `list(initial)`
Returns an `Atom<T[]>` with:
- **Read:** `.at(index)`, `.length()`, `.includes(item)`
- **Write:** `.push(item)`, `.pop()`, `.remove(item)`, `.set(newList)`, `.reset()`

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

These are the low-level primitives. Use them directly when the fluent helpers do not fit your use case.

### `state(initial)`

Creates a mutable atom holding a value of type `T`.

```ts
const count   = state(0)
const name    = state('Alice')
const active  = state(true)
const items   = state<string[]>([])
```

`Atom<T>` is just `{ _type: 'state', start: T }` — a plain object. No side effects occur at creation.

---

### `calc(fn, deps)`

Creates a derived value from other values.

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

`deps` can contain atoms, other calcs, `iff()` nodes, or plain values. `calc()` is memoized, so it only recomputes when one of its resolved deps changes.

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

Creates an update for an atom. The value can be a plain value or another node.

```ts
const score = state(0)

set(score, 42)            // write a literal
set(score, add(score, 1)) // write a derived value
```

Nothing happens until the update is passed to `send()`.

---

### `iff(...conditionGroups)(...outputs)`

A curried conditional constructor.

```
iff( [cond₁, cond₂, ...], [cond₃, ...], ... )
   ( output₀,              output₁,       fallback )
```

Each condition group is an `AND`. Groups are checked left to right. The first matching group wins. If nothing matches, the last output is the fallback.

**Shorthand:** If a group contains only one condition, you can omit the array wrapper.

```ts
// Shorthand for single condition
iff(eq(level, 1))(5, 10)

// Array required for multiple conditions (AND)
iff([eq(level, 1), isReady])(5, 10)
```

Use it for transitions:

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

Or use it as a value selector:

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

Outputs can also be nested `Iff` nodes.

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

Creates an isolated runtime. Returns a `Runtime` with `{ get, send, watch, on }`.

```ts
const { get, send, watch, on } = run()
```

Each call to `run()` gets its own store, so the same nodes can be reused in multiple runtimes without interference.

#### `get(node)`

Reads the current value of any node or plain value.

```ts
get(score)    // current value of the atom
get(doubled)  // recomputed if deps changed, otherwise cached
get(target)   // iff selects the right branch
get(42)       // plain values pass through
```

#### `send(action)`

Applies one or more updates **atomically**:

1. All new values are resolved against the **pre-send** store snapshot (order-independent).
2. All mutations are written.
3. Watchers whose deps changed are notified.
4. Runtime `on()` handlers are reconciled against the committed state.

```ts
send(set(x, 1))                      // single set
send([set(x, 1), set(y, 2)])         // batch
send(conditionalAction)               // `Iff` node — branching resolved internally
send([actionA, actionB, conditionalC]) // arrays are flattened recursively
```

#### `watch(fn, depOrDeps)`

Runs a callback after `send()` when one of the watched values actually changes. Returns an unsubscribe function.

```ts
const unsub = watch((score) => {
  console.log(`score=${score}`)
}, score)

send(set(score, 10)) // callback fires
unsub()
send(set(score, 20)) // callback is silent
```

You can pass a single dep or an array of deps. `watch()` accepts atoms, calcs, and `iff()` nodes, and only fires when their resolved output changes.

```ts
const doubled = mul(score, 2)
watch((d) => console.log(d), [doubled])

send([set(a, 1), set(b, 6)]) // if product is stable, watcher stays silent
```

#### `on(condition)(handler)`

Runs a handler when a condition is entered, and optionally runs cleanup when that condition is exited.

- If the condition is already truthy when you register it, the handler runs immediately.
- While the condition stays truthy, the handler does not rerun.
- If the handler returns a cleanup function, that cleanup runs once on exit.
- You can also pass an array of conditions. Arrays are treated as an `AND`.

```ts
const timeout = (action, time) => {
  const id = setTimeout(action, time)
  return () => clearTimeout(id)
}

const { get, send, on } = run()

on(light.is.red)(() => timeout(() => send(light.setTo.green), get(time)))
on(light.is.green)(() => timeout(() => send(light.setTo.red), get(time)))

on([isLoggedIn, hasToken])(() => {
  console.log('session is fully ready')
})
```

`on()` runs only after a full `send()` commit, so handlers always see the final post-send state.

The return value is an unsubscribe function. You can also chain `.exit()` to run code when the condition is exited after being entered:

```ts
const unon = on(debugMode)(() => {
  console.log('debug mode entered')
  return () => console.log('debug mode exited')
}).exit(() => {
  console.log('debug mode left')
})

unon()
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

Build UI-ready values without storing duplicated state:

```ts
const price = num(120)
const quantity = num(2)
const discount = num(20)

const subtotal = price.mul(quantity)
const total = subtotal.sub(discount)

const { get } = run()
get(total) // 220
```

### Conditional transitions

Use `iff()` for common UI flows like loading, success, and error:

```ts
const status = choice('idle', 'saving', 'saved', 'error')
const hasName = bool(false)
const hasError = bool(false)

const next = iff(
  status.is.idle,
  [status.is.saving, hasName],
  [status.is.saving, hasError],
)(
  status.setTo.saving,
  status.setTo.saved,
  status.setTo.error,
)

const { send, get } = run()

send(next)                 // idle -> saving
send(hasName.set(true))
send(next)                 // saving -> saved
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

Use `watch()` when you want to react to value changes, log state, or bridge into UI code.

```ts
const search = text('')
const status = choice('idle', 'loading', 'done')

const { send, watch } = run()

watch(
  (value, nextStatus) => console.log({ value, nextStatus }),
  [search, status],
)

send(search.set('notebook'))
send(status.setTo.loading)
```

### Lifecycle effects

Use `on()` for timers, polling, subscriptions, or any effect that should exist only while a condition is true.

```ts
const modal = bool(false)

const lockScroll = () => {
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = ''
  }
}

const { send, on } = run()

const unmodal = on(modal)(lockScroll)
  .exit(() => console.log('modal closed'))
```

Another common pattern is delayed transitions:

```ts
const light = choice('red', 'green')
const delay = num(1000)

const timeout = (action, ms) => {
  const id = setTimeout(action, ms)
  return () => clearTimeout(id)
}

const { get, send, on } = run()

const unred = on(light.is.red)(() => timeout(() => send(light.setTo.green), get(delay)))
const ungreen = on(light.is.green)(() => timeout(() => send(light.setTo.red), get(delay)))

// later
unred()
ungreen()
```

### Debounced search

Use `watch()` when the behavior should restart every time a value changes.

```ts
const query = text('')
const status = choice('idle', 'typing', 'loading')
const { send, watch, get } = run()

let timeoutId: ReturnType<typeof setTimeout> | undefined

const unwatch = watch((value) => {
  clearTimeout(timeoutId)

  if (value === '') {
    send(status.setTo.idle)
    return
  }

  send(status.setTo.typing)
  timeoutId = setTimeout(() => {
    searchApi(get(query))
    send(status.setTo.loading)
  }, 300)
}, query)
```

### Autosave form

This is the same pattern as debouncing, but pointed at persistence.

```ts
const name = text('')
const email = text('')
const saveState = choice('idle', 'dirty', 'saving', 'saved')
const { send, watch, get } = run()

let saveTimer: ReturnType<typeof setTimeout> | undefined

watch(() => {
  clearTimeout(saveTimer)
  send(saveState.setTo.dirty)

  saveTimer = setTimeout(async () => {
    send(saveState.setTo.saving)
    await saveProfile({
      name: get(name),
      email: get(email),
    })
    send(saveState.setTo.saved)
  }, 800)
}, [name, email])
```

### Polling while loading

Use `on()` when work should start on enter and stop on exit.

```ts
const status = choice('idle', 'loading', 'done', 'error')
const { send, on } = run()

on(status.is.loading)(() => {
  const id = setInterval(() => {
    send(refreshStatus())
  }, 1000)

  return () => clearInterval(id)
})
```

### Auth or session ready

`on()` accepts an array, which works like an `AND` group.

```ts
const isLoggedIn = bool(false)
const hasToken = bool(false)
const { on } = run()

on([isLoggedIn, hasToken])(() => {
  bootProtectedArea()
}).exit(() => {
  teardownProtectedArea()
})
```

### WebSocket subscription

When a subscription is keyed by a value like `roomId`, `watch()` is often the right tool because it reruns when the key changes.

```ts
const roomId = text('')
const messages = list<string>([])
const { send, watch } = run()

let cleanup = () => {}

const unwatch = watch((room) => {
  cleanup()

  if (room === '') return

  const socket = new WebSocket(`/rooms/${room}`)
  socket.onmessage = (event) => {
    send(messages.push(event.data))
  }

  cleanup = () => socket.close()
}, roomId)
```

### Debugging

Use `trace()` when you want to log values, and `traceSend()` when you want to log actions.

```ts
import { run, num, trace, traceSend } from 'sac'

const score = num(0)
const runtime = run()
const send = traceSend(runtime, { label: 'actions' })

const untrace = trace(runtime, [score, score.add(1)], {
  label: 'score',
})

send(score.set(5))
// logs: [sac:actions] { ...action }
// logs: [sac:score] 5 6

untrace()
```

Both helpers are small wrappers over the existing runtime API, so they are easy to remove once you are done debugging.

For now, that is the debugging story: plain runtime hooks with tiny helpers. If the library grows, those same hooks could support a browser panel or devtools integration later.

### Composing helpers

Helpers compose freely:

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

Multiple runtimes can share the same definitions without sharing state:

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

Useful for tests, previews, or per-request server state.

---

## Examples

- React example: [`examples/react-profile-save/README.md`](examples/react-profile-save/README.md)
- Vanilla example: [`examples/vanilla-traffic-light/README.md`](examples/vanilla-traffic-light/README.md)

---

## Integrations

`sac` includes small helpers for popular UI frameworks.

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

`resolve(node)` is the core evaluator:

- `Atom` → reads from the store (falls back to `initial`)
- `Calc` → checks memoisation cache; recomputes if any dep changed
- `Iff` → tests condition groups; returns the matching output
- Plain values/arrays → returned as-is

`send(action)` follows a snapshot-then-write flow:

1. Snapshot resolved dep values for all current watchers.
2. Collect all `Update` nodes from the action (recursing through arrays and `Iff` nodes).
3. Resolve all new values against the **pre-send** snapshot.
4. Write all values to the store.
5. Notify watchers whose dep values changed.

That is why one `send()` always sees a consistent pre-send snapshot.
