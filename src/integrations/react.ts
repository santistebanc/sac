import { createContext, useContext, useMemo, useSyncExternalStore, createElement, type ReactNode } from 'react'
import { run } from '../core.js'
import type { Val, Action } from '../core.js'

type SacRuntime = ReturnType<typeof run>
const SacContext = createContext<SacRuntime | null>(null)

/**
 * Provides a SAC runtime to the React component tree.
 */
export function SacProvider({ children, runtime }: { children: ReactNode, runtime?: SacRuntime }) {
    const value = useMemo(() => runtime ?? run(), [runtime])
    return createElement(SacContext.Provider, { value }, children)
}

/**
 * Returns the SAC runtime instance from context.
 */
export function useSac() {
    const ctx = useContext(SacContext)
    if (!ctx) throw new Error('useSac must be used within a SacProvider')
    return ctx
}

/**
 * Subscribes to a SAC node (Atom, Calc, or Iff) and returns its current value.
 * Re-renders whenever the node's value changes.
 */
export function useVal<T>(node: Val<T>): T {
    const { get, watch } = useSac()
    return useSyncExternalStore(
        (callback) => watch(callback, [node]),
        () => get(node)
    )
}

/**
 * Returns the 'send' function from the current SAC runtime.
 */
export function useSend() {
    return useSac().send
}
