/**
 * Playground — Network Connection State Machine
 *
 * Shows the library at its best:
 *   • state() atoms for each piece of data
 *   • calc() nodes as composable, reusable guards
 *   • iff() as BOTH action dispatcher AND value selector (reconnectDelay)
 *   • Atomic multi-mutation sends (status + retries in one send)
 *   • Observers watching calc nodes (not just raw atoms)
 *   • Guards blocking invalid transitions at definition time
 *
 * Run:  node --experimental-strip-types playground.ts
 *
 * State machine diagram:
 *
 *   ┌──────────────────── onError(!canReconnect) ─────────────────────┐
 *   │              ┌───── onError(!canReconnect) ───────┐              │
 *   │              │                                    │              │
 *   ▼              │   onError(canReconnect)            │              │
 * disconnected ──► connecting ──────────────────► reconnecting         │
 *   ▲    ▲             │                               │  ▲            │
 *   │    │             │ onConnected                   │  │ onError    │
 *   │    │             ▼                               │  │ (canRec.)  │
 *   │    └────── connected ◄────────────────────────── ┘  │            │
 *   │                  │                                   │            ▼
 *   │                  └─────────── onError ───────────────┘     (gives up)
 *   └────────────────────────── disconnect ──────────────────────────────
 */

import { state, calc, set, iff, run, type Resolvable, type CalcNode } from './src/index.ts'

// ─── Generic helpers ──────────────────────────────────────────────────────────

const eq = <T>(a: Resolvable<T>, b: Resolvable<T>): CalcNode<boolean> =>
    calc((x: unknown, y: unknown) => x === y, [a, b])

const lt = (a: Resolvable<number>, b: Resolvable<number>): CalcNode<boolean> =>
    calc((x: number, y: number) => x < y, [a, b])

const or = (a: Resolvable<boolean>, b: Resolvable<boolean>): CalcNode<boolean> =>
    calc((x: boolean, y: boolean) => x || y, [a, b])

const inc = (n: Resolvable<number>): CalcNode<number> =>
    calc((x: number) => x + 1, [n])

// ─── State atoms ──────────────────────────────────────────────────────────────

type Status = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

const status = state<Status>('disconnected')
const retries = state(0)
const maxRetries = state(3)

// ─── Computed guards ──────────────────────────────────────────────────────────

const isDisconnected = eq(status, 'disconnected')
const isConnecting = eq(status, 'connecting')
const isConnected = eq(status, 'connected')
const isReconnecting = eq(status, 'reconnecting')

// True while a connection attempt is in flight
const isAttempting = or(isConnecting, isReconnecting)

// True whenever the connection is active (can be lost or fail)
const isActive = or(isAttempting, isConnected)

// Whether we have retries left
const canReconnect = lt(retries, maxRetries)

// ─── iff as value selector — exponential backoff ──────────────────────────────
// Not an action — resolves to a plain number (ms to wait before next attempt).
// iff here acts as a computed switch expression over the current retry count.

const reconnectDelay = iff(
    [lt(retries, 1)],
    [lt(retries, 2)],
    [lt(retries, 3)],
)(1_000, 2_000, 4_000, 8_000)

// ─── Actions ──────────────────────────────────────────────────────────────────

// Guard: only valid from disconnected. Any other status → no-op.
const connect = iff(
    [isDisconnected],
)(
    set(status, 'connecting'),
)

// Mark connection as established; reset the retry counter atomically.
const onConnected = iff(
    [isAttempting],
)(
    [set(status, 'connected'), set(retries, 0)],
)

// Handle a connection failure:
//   if retries remain   → move to reconnecting, increment counter (one atomic send)
//   if max retries hit  → give up, fall back to disconnected
const onError = iff(
    [isActive, canReconnect],
)(
    [set(status, 'reconnecting'), set(retries, inc(retries))],
    set(status, 'disconnected'), // fallback — max retries exceeded
)

// Unconditional disconnect (no guard — always valid)
const disconnect = set(status, 'disconnected')

// Reset and prepare for a fresh run
const reset = [set(status, 'disconnected'), set(retries, 0)]

// ─── Run ──────────────────────────────────────────────────────────────────────

const { send, get, observe } = run()

// Observer watching a CALC node — fires only when isConnected flips, not on
// every send. This is the key advantage over watching the raw status atom.
observe((online: boolean) => {
    console.log(`  ↳ [observer] isConnected → ${online}`)
}, [isConnected])

// Observer watching two nodes at once: retries + the delay selector.
// Neither is a raw atom — both are derived. Fires only when retries changes.
observe((r: number, delay: number) => {
    if (r > 0) console.log(`  ↳ [observer] retry #${r} scheduled — delay: ${delay}ms`)
}, [retries, reconnectDelay])

// ─── Simulation ───────────────────────────────────────────────────────────────

const snap = () =>
    `status: ${get(status).padEnd(14)} retries: ${get(retries)}/${get(maxRetries)}`

console.log('\n══ 1. Normal connection ═══════════════════════════════════')
console.log('before: ', snap())
send(connect)
console.log('connect:', snap())
send(onConnected)
console.log('conn ok:', snap())

console.log('\n══ 2. Connection drops — retry then recover ════════════════')
send(onError); console.log('error 1:', snap(), `  (delay: ${get(reconnectDelay)}ms)`)
send(onError); console.log('error 2:', snap(), `  (delay: ${get(reconnectDelay)}ms)`)
send(onConnected); console.log('conn ok:', snap())

console.log('\n══ 3. Exhaust retries — give up ════════════════════════════')
send(onError); console.log('error 1:', snap())
send(onError); console.log('error 2:', snap())
send(onError); console.log('error 3:', snap())
send(onError); console.log('gave up:', snap())

console.log('\n══ 4. Guard test — connect while already connecting ════════')
send(reset)
send(connect); console.log('connect:', snap())
send(connect); console.log('connect:', snap(), '  ← no-op (guard: isDisconnected)')

console.log('\n══ 5. Explicit disconnect ══════════════════════════════════')
send(onConnected) // finish connecting first
send(disconnect)
console.log('disconn:', snap())

console.log('\n══ 6. iff as value selector — backoff schedule ═════════════')
send(reset)
send(connect)
for (let i = 0; i < 4; i++) {
    send(onError)
    const r = get(retries)
    const d = get(reconnectDelay)  // resolves the iff switch expression
    if (r <= get(maxRetries)) {
        console.log(`  retries=${r}  → reconnectDelay=${d}ms`)
    }
}

console.log('\ndone.')
