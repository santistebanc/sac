# Vanilla Traffic Light

A non-framework example showing:
- `choice()` and `num()`
- `on()` for enter/exit effects
- delayed transitions with plain `setTimeout`

```ts
import { choice, num, run } from 'sac'

const light = choice('red', 'green')
const delay = num(1000)

const timeout = (action: () => void, ms: number) => {
  const id = setTimeout(action, ms)
  return () => clearTimeout(id)
}

const { get, send, on } = run()

const unred = on(light.is.red)(() => {
  return timeout(() => send(light.setTo.green), get(delay))
})

const ungreen = on(light.is.green)(() => {
  return timeout(() => send(light.setTo.red), get(delay))
})

console.log(get(light)) // red

// later
unred()
ungreen()
```
