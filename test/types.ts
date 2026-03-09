import {
    run, bool, num, trace, traceSend,
    type Runtime, type OnRegistration, type WatchUnsubscribe,
} from '../src/index.js'

const runtime: Runtime = run()
const active = bool(false)
const count = num(0)

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

tracedSend(count.inc())
registration()
unwatchOne()
unwatchMany()
tracedWatch()
