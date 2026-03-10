import { labelOf, type Action, type Runtime } from './core.js'

export type TraceLogger = (...args: unknown[]) => void

export function trace<D extends readonly unknown[]>(
    runtime: Runtime,
    deps: readonly [...D],
    options?: {
        label?: string
        logger?: TraceLogger
    },
) {
    const derivedLabel = deps.map(dep => labelOf(dep)).filter((name): name is string => !!name).join(', ')
    const { label = derivedLabel || 'trace', logger = console.log } = options ?? {}

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
        const inspected = runtime.inspect({ action }).entries[0]
        const payload =
            labelOf(action)
            ?? (inspected?.type === 'set'
                ? { type: inspected.type, atom: inspected.atom, value: inspected.value }
                : action)

        logger(`[sac:${label}]`, payload)
        runtime.send(action)
    }
}
