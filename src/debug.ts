import type { Action, Runtime } from './core.js'

export type TraceLogger = (...args: unknown[]) => void

export function trace<D extends readonly unknown[]>(
    runtime: Runtime,
    deps: readonly [...D],
    options?: {
        label?: string
        logger?: TraceLogger
    },
) {
    const { label = 'trace', logger = console.log } = options ?? {}

    return runtime.watch((...values: any[]) => {
        logger(`[sac:${label}]`, ...values)
    }, deps)
}

export function traceSend(
    runtime: Runtime,
    options?: {
        label?: string
        logger?: TraceLogger
    },
) {
    const { label = 'send', logger = console.log } = options ?? {}

    return (action: Action) => {
        logger(`[sac:${label}]`, action)
        runtime.send(action)
    }
}
