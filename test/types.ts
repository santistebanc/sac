import {
    run, bool, num, family, trace, traceSend, labelOf,
    type Runtime, type OnRegistration, type WatchUnsubscribe, type CommittedUpdate, type Inspection,
} from '../src/index.js'

const runtime: Runtime = run()
const active = bool(false)
const count = num(0)
const hydratedRuntime: Runtime = run([count.set(1)])
const committedUpdates: CommittedUpdate[] = []

const unwatchOne: WatchUnsubscribe = runtime.watch((value: boolean) => {
    void value
}, active)

const unwatchMany: WatchUnsubscribe = runtime.watch((value: number, isActive: boolean) => {
    void value
    void isActive
}, [count, active])

const registration: OnRegistration = runtime.on([active, active.not()])(() => undefined).exit(() => {})

const tracedWatch: WatchUnsubscribe = trace(runtime, [count])
const tracedSend = traceSend(runtime)
const keyedCount = family((id: string) => num(id.length))
const resetCount = count.reset()
const snapshot: readonly CommittedUpdate[] = runtime.snapshot()
const namedSnapshot: readonly CommittedUpdate[] = runtime.snapshot({ count })
const inspection: Inspection = runtime.inspect({ count, resetCount })
runtime.onCommit((updates) => {
    committedUpdates.push(...updates)
})
runtime.label({ active, count, resetCount })
runtime.dispose()

tracedSend(count.inc())
hydratedRuntime.get(count)
keyedCount('abc').set(5)
labelOf(resetCount)
snapshot.length
namedSnapshot.length
inspection.entries.length
registration()
unwatchOne()
unwatchMany()
tracedWatch()
