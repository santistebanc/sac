import type { Val, Runtime } from '../core.js'

/**
 * Converts a SAC node into a Svelte-compatible store.
 * 
 * @example
 * const countStore = toStore(counter, runtime);
 * $countStore // Use with $ prefix in .svelte files
 */
export function toStore<T>(node: Val<T>, runtime: Runtime) {
    return {
        subscribe(callback: (v: T) => void) {
            // Initial call
            callback(runtime.get(node))
            // Watch for changes
            return runtime.watch((v: any) => callback(v), node)
        }
    }
}
