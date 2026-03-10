# sac

**S**tate · **A**ctions · **C**omputations

```ts
import { text, choice, iff, run } from 'sac'

const name = text('')
const status = choice('idle', 'saving', 'saved', 'error')

const saveProfile = iff([name.neq(''), status.isNot.saving])(
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

A small framework-agnostic TypeScript state library for app logic.

Think of it as:
- lighter than XState
- more structured than Zustand
- usable outside React

Use `sac` when you want:
- explicit transitions instead of setter soup
- derived state without duplicated fields
- small runtime hooks for watchers and enter/exit effects
- logic you can share across React, Vue, Svelte, or plain TypeScript

## Install

```bash
npm install github:santistebanc/sac
```

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": true,
    "strict": true
  }
}
```

## Core shape

Most code uses:
- `num()`, `text()`, `bool()`, `choice()` for state
- `family()` for keyed state you want to reuse by id
- `iff()` for transitions and selectors
- `run()` for `{ get, send, watch, on }`

If you want the lower-level primitives, they are:
- `state(initial)`
- `calc(fn, deps)`
- `set(atom, value)`
- `iff(...conditions)(...outputs)`

## Quick examples

### Derived state

```ts
import { num, run } from 'sac'

const price = num(120)
const quantity = num(2)
const discount = num(20)

const subtotal = price.mul(quantity)
const total = subtotal.sub(discount)

const { get } = run()
get(total) // 220
```

### Conditional transitions

```ts
import { choice, bool, iff, run } from 'sac'

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

const { send } = run()

send(next)              // idle -> saving
send(hasName.set(true))
send(next)              // saving -> saved
```

### Atomic updates

```ts
import { num, run } from 'sac'

const x = num(10)
const y = num(0)
const { get, send } = run()

send([x.set(x.add(5)), y.set(x.add(3))])

get(x) // 15
get(y) // 13
```

### Keyed state

```ts
import { family, bool, run } from 'sac'

const expanded = family((id: string) => bool(false))
const { get, send } = run()

send(expanded('todo-1').set(true))

get(expanded('todo-1')) // true
get(expanded('todo-2')) // false
```

## Runtime API

### `run(initialUpdates?)`

Pass `run()` an optional array of update descriptors to hydrate the runtime before anything subscribes.

```ts
const user = text('')
const status = choice('idle', 'ready')

const runtime = run([
  user.set('Ada'),
  status.setTo.ready,
])

runtime.get(user)   // 'Ada'
runtime.get(status) // 'ready'
```

Hydration is silent:
- no `onCommit()` call
- no `watch()` callback
- no automatic startup reconciliation beyond the current state seen by later `get()` or `on(...)`

### `watch()`

Use `watch()` when behavior should rerun when values change.

```ts
const query = text('')
const { send, watch } = run()

const unwatch = watch((value) => {
  console.log('query:', value)
}, query)

send(query.set('notebook'))
unwatch()
```

`watch()` accepts either:
- one dep: `watch(fn, query)`
- many deps: `watch(fn, [query, status])`

### `onCommit()`

Use `onCommit()` when you want the exact committed batch from each `send()`.

```ts
const { send, onCommit } = run()

const uncommit = onCommit((updates) => {
  // updates are resolved set-shaped entries
  console.log(updates)
})

send(status.setTo.saving)
uncommit()
```

### `on()`

Use `on()` for enter/exit effects that should stay active while a condition is true.

```ts
const modal = bool(false)
const { on } = run()

const unlock = on(modal)(() => {
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = ''
  }
}).exit(() => {
  console.log('modal closed')
})

unlock()
```

`on()` accepts either:
- one condition: `on(status.is.loading)(...)`
- an AND group: `on([isLoggedIn, hasToken])(...)`

## Useful recipes

### Debounced search

```ts
const query = text('')
const status = choice('idle', 'typing', 'loading')
const { send, watch, get } = run()

let timeoutId: ReturnType<typeof setTimeout> | undefined

watch((value) => {
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

### Auth/session ready

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

```ts
const roomId = text('')
const messages = list<string>([])
const { send, watch } = run()

let cleanup = () => {}

watch((room) => {
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

```ts
import { run, num, trace, traceSend } from 'sac'

const score = num(0)
const runtime = run()
const send = traceSend(runtime, { label: 'actions' })

const untrace = trace(runtime, [score, score.add(1)], {
  label: 'score',
})

send(score.set(5))
// [sac:actions] { ...action }
// [sac:score] 5 6

untrace()
```

## Fluent API

The fluent constructors are the recommended API for day-to-day use.

### `num(initial)`
- read: `.add()`, `.sub()`, `.mul()`, `.div()`, `.mod()`, `.pow()`, `.abs()`, `.min()`, `.max()`, `.clamp()`, `.floor()`, `.ceil()`, `.round()`
- compare: `.lt()`, `.lte()`, `.gt()`, `.gte()`, `.eq()`, `.neq()`
- write: `.set()`, `.inc()`, `.dec()`, `.reset()`

### `text(initial)`
- read: `.concat()`, `.includes()`, `.length()`, `.trim()`, `.toUpper()`, `.toLower()`, `.split()`, `.slice()`, `.replace()`, `.startsWith()`, `.endsWith()`
- compare: `.eq()`, `.neq()`
- write: `.set()`, `.reset()`

### `bool(initial)`
- read: `.not()`, `.and()`, `.or()`
- compare: `.eq()`, `.neq()`
- write: `.set()`, `.toggle()`, `.reset()`

### `list(initial)`
- read: `.at()`, `.length()`, `.includes()`, `.join()`, `.map()`, `.filter()`, `.reduce()`, `.find()`, `.some()`, `.every()`, `.intersect()`
- write: `.push()`, `.pop()`, `.unshift()`, `.shift()`, `.remove()`, `.clear()`, `.set()`, `.reset()`

### `choice(...options)`
- compare: `.is.option`, `.isNot.option`, `.eq()`, `.neq()`
- write: `.setTo.option`, `.set()`, `.reset()`

## Integrations

### React

```tsx
import { SacProvider, useVal, useSend } from 'sac/react'
import { num, run } from 'sac'

const score = num(0)
const runtime = run()

function Counter() {
  const value = useVal(score)
  const send = useSend()

  return (
    <button onClick={() => send(score.inc())}>
      Score is: {value}
    </button>
  )
}

export default function App() {
  return (
    <SacProvider runtime={runtime}>
      <Counter />
    </SacProvider>
  )
}
```

### Vue

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

```html
<script>
  import { toStore } from 'sac/svelte'
  import { score, runtime } from './store'

  const scoreStore = toStore(score, runtime)
</script>

<h1>Score is {$scoreStore}</h1>
```

## More examples

- React example: [`examples/react-profile-save/README.md`](examples/react-profile-save/README.md)
- Vanilla example: [`examples/vanilla-traffic-light/README.md`](examples/vanilla-traffic-light/README.md)
