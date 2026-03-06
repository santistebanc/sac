// ─── Utility types ──────────────────────────────────────────────────────────

/** Extract the resolved value type from any node or plain value. */
type ResolveOne<R> =
    R extends Atom<infer T> ? T :
    R extends Calc<infer T> ? T :
    R extends Iff<infer T> ? T :
    // Handle the Val<T> union specifically so it doesn't fall through to the union itself
    R extends number | string | boolean | null | undefined ? R :
    R extends Val<infer T> ? T :
    R

/** Map a tuple of mixed resolvables to their resolved value types. */
type ResolvedDeps<D extends readonly unknown[]> = {
    [K in keyof D]: ResolveOne<D[K]>
}

// ─── Node interfaces ─────────────────────────────────────────────────────────

export interface Atom<T> {
    readonly _type: 'state'
    readonly initial: T
}

export interface Calc<T> {
    readonly _type: 'calc'
    /** Typed loosely internally; precision is enforced at construction via calc(). */
    readonly fn: (...args: any[]) => T
    readonly deps: readonly unknown[]
}

export interface Update<T> {
    readonly _type: 'set'
    readonly atom: Atom<T>
    readonly value: Val<T>
}

export interface Iff<T> {
    readonly _type: 'iff'
    readonly conditionGroups: readonly (unknown | readonly unknown[])[]
    readonly outputs: readonly T[]
}

/** Anything that can be lazily resolved to a value of type T. */
export type Val<T> = T | Atom<T> | Calc<T> | Iff<T>

/** Anything that can be dispatched via send(). */
export type Action = Update<any> | Iff<any> | Action[]

// ─── Constructors ────────────────────────────────────────────────────────────

export function state<T>(initial: T): Atom<T> {
    return { _type: 'state', initial }
}

/**
 * Create a derived value node. The fn receives the resolved values of deps
 * and returns R. TypeScript infers dep types from the deps tuple.
 */
export function calc<D extends readonly unknown[], R>(
    fn: (...args: ResolvedDeps<D>) => R,
    deps: readonly [...D],
): Calc<R> {
    return { _type: 'calc', fn: fn as (...args: any[]) => R, deps }
}

export function set<T>(atom: Atom<T>, value: Val<T>): Update<T> {
    return { _type: 'set', atom, value }
}

/**
 * iff(...conditionGroups)(...outputs)
 *
 * Evaluation: tests each condition group left-to-right.
 * Returns outputs[i] when ALL nodes in conditionGroups[i] are truthy.
 * Falls back to outputs[conditionGroups.length] if no group matches.
 *
 * Can return either actions (Update nodes / arrays) or plain values,
 * acting as both a conditional transition and a computed selector.
 */
export function iff(
    ...conditionGroups: readonly (unknown | readonly unknown[])[]
): <T extends readonly unknown[]>(...outputs: T) => Iff<T[number]> {
    return <T extends readonly unknown[]>(...outputs: T) => ({
        _type: 'iff',
        conditionGroups,
        outputs,
    }) as Iff<T[number]>
}

// ─── Runtime ─────────────────────────────────────────────────────────────────

type WatchEntry = { fn: (...args: any[]) => void; deps: readonly unknown[] }

export function run() {
    const store = new Map<Atom<any>, any>()
    const watchers = new Set<WatchEntry>()

    /**
     * Calc memoisation cache: Calc → { depValues, result }
     * Invalidation is implicit — dep values are re-resolved on every call;
     * a mismatch triggers recomputation. Object.is semantics handle NaN / ±0.
     */
    const calcCache = new WeakMap<Calc<any>, { depValues: unknown[]; result: any }>()

    // ── resolve: evaluate any node to a plain JS value ───────────────────────
    function resolve(node: unknown): unknown {
        if (node == null || typeof node !== 'object' || !('_type' in node)) return node

        switch ((node as { _type: string })._type) {
            case 'state': {
                const s = node as Atom<any>
                if (!store.has(s)) store.set(s, s.initial)
                return store.get(s)
            }
            case 'calc': {
                const c = node as Calc<any>
                const args = c.deps.map(resolve)
                const cached = calcCache.get(c)
                // calc nodes are immutable so deps.length is constant — no length check needed.
                if (cached && cached.depValues.every((v, i) => Object.is(v, args[i]))) {
                    return cached.result
                }
                const result = c.fn(...args)
                calcCache.set(c, { depValues: args, result })
                return result
            }
            case 'iff': {
                const n = node as Iff<unknown>
                for (let i = 0; i < n.conditionGroups.length; i++) {
                    const group = n.conditionGroups[i]
                    const conditions = Array.isArray(group) ? group : [group]
                    if (conditions.every(c => !!resolve(c))) return n.outputs[i]
                }
                // fallback (index === conditionGroups.length); may be undefined → no-op
                return n.outputs[n.conditionGroups.length]
            }
            default:
                // Update nodes and unknown types returned as-is (actions-as-values supported).
                return node
        }
    }

    // ── collectMuts: flatten a sendable value into an ordered list of Update nodes ─
    // Delegates branching to resolve(), then traverses the result.
    // Recurses when resolve() returns a further node (e.g. nested iff → iff).
    function collectMuts(node: unknown): Update<any>[] {
        const v = resolve(node)
        if (Array.isArray(v)) return v.flatMap(collectMuts)
        if ((v as any)?._type === 'set') return [v as Update<any>]
        if (v !== node && (v as any)?._type) return collectMuts(v)
        return []
    }

    // ── Public API ────────────────────────────────────────────────────────────

    function get<T>(node: Val<T>): T {
        return resolve(node) as T
    }

    function send(action: Action): void {
        const muts = collectMuts(action)

        // ① Snapshot the resolved value of every watcher dep BEFORE any write.
        //    Works for atoms, calc nodes, iff nodes — any node type.
        //    Pair each watcher with its snapshot so mid-loop unsubscribes are safe.
        const planned = [...watchers].map(w => ({ w, snap: w.deps.map(resolve) }))

        // ② Resolve ALL new values against the pre-send store BEFORE any write.
        //    Makes mutations within one send independent of each other's order.
        const values = muts.map(m => resolve(m.value))

        // ③ Apply mutations atomically
        muts.forEach((m, i) => store.set(m.atom, values[i]))

        // ④ Notify watchers whose deps changed.
        //    Iterate the pre-send snapshot so additions/removals don't corrupt the loop.
        //    Object.is gives correct NaN and ±0 semantics.
        for (const { w, snap } of planned) {
            if (!watchers.has(w)) continue // was unsubscribed mid-loop
            const next = w.deps.map(resolve)
            if (next.some((v, j) => !Object.is(v, snap[j]))) w.fn(...next)
        }
    }

    /**
     * Register a callback fired after send() whenever any dep's resolved value changes.
     * Dep types are inferred from the deps tuple — works for atoms, calc, and iff nodes.
     * @returns unsubscribe function
     */
    function watch<D extends readonly unknown[]>(
        fn: (...args: ResolvedDeps<D>) => void,
        deps: readonly [...D],
    ): () => void {
        const entry: WatchEntry = { fn: fn as (...args: any[]) => void, deps }
        watchers.add(entry)
        return () => watchers.delete(entry)
    }

    return { send, get, watch }
}
