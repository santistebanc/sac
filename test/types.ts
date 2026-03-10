import {
    run, bool, num, trace, traceSend,
    type Runtime, type OnRegistration, type WatchUnsubscribe, type CommittedUpdate,
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
runtime.onCommit((updates) => {
    committedUpdates.push(...updates)
})

tracedSend(count.inc())
hydratedRuntime.get(count)
registration()
unwatchOne()
unwatchMany()
tracedWatch()
