# React Profile Save

A small React example showing:
- `SacProvider`
- `useVal()`
- `useSend()`
- derived UI state
- autosave with `on()`

```tsx
import { SacProvider, useVal, useSend } from 'sac/react'
import { text, choice, run } from 'sac'

const name = text('')
const email = text('')
const saveState = choice('idle', 'dirty', 'saving', 'saved')
const runtime = run()

let saveTimer: ReturnType<typeof setTimeout> | undefined

runtime.watch(() => {
  clearTimeout(saveTimer)
  runtime.send(saveState.setTo.dirty)

  saveTimer = setTimeout(() => {
    runtime.send(saveState.setTo.saving)

    // fake request
    setTimeout(() => {
      runtime.send(saveState.setTo.saved)
    }, 600)
  }, 800)
}, [name, email])

function ProfileForm() {
  const currentName = useVal(name)
  const currentEmail = useVal(email)
  const currentSaveState = useVal(saveState)
  const send = useSend()

  return (
    <div>
      <input
        value={currentName}
        onChange={(e) => send(name.set(e.target.value))}
        placeholder="Name"
      />

      <input
        value={currentEmail}
        onChange={(e) => send(email.set(e.target.value))}
        placeholder="Email"
      />

      <p>Status: {currentSaveState}</p>
    </div>
  )
}

export default function App() {
  return (
    <SacProvider runtime={runtime}>
      <ProfileForm />
    </SacProvider>
  )
}
```
