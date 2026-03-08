import { shallowRef, onUnmounted, type Ref } from 'vue'
import type { Val, run } from '../core.js'

/**
 * A Vue composable that binds a SAC node to a Vue ref.
 * 
 * @example
 * const count = useVal(counter, runtime);
 * console.log(count.value);
 */
export function useVal<T>(node: Val<T>, runtime: ReturnType<typeof run>): Ref<T> {
    const r = shallowRef(runtime.get(node))

    const unsub = runtime.watch((v: any) => {
        r.value = v
    }, [node])

    onUnmounted(unsub)

    return r as Ref<T>
}
