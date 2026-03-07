// ─── Utility types ──────────────────────────────────────────────────────────

/** Extract the resolved value type from any node or plain value. */
type ResolveOne<R> =
    R extends Atom<infer T> ? T :
    R extends Calc<infer T> ? T :
    R extends Iff<infer T> ? T :
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

export type Val<T> = T | Atom<T> | Calc<T> | Iff<T>
export type Action = Update<any> | Iff<any> | Action[]

// ─── Analysis ────────────────────────────────────────────────────────────────

const atomsCache = new WeakMap<object, Set<Atom<any>>>()

/** Recursively find all Atoms reachable from any node (State, Calc, or Iff). */
function findAtoms(node: unknown, visited = new Set<unknown>()): Set<Atom<any>> {
    if (node == null || typeof node !== 'object') return new Set()
    const cached = atomsCache.get(node)
    if (cached) return cached

    const nodeObj = node as any
    if (!nodeObj._type) return new Set()

    if (visited.has(node)) return new Set()
    visited.add(node)

    const atoms = new Set<Atom<any>>()

    if (nodeObj._type === 'state') {
        atoms.add(nodeObj)
    } else if (nodeObj._type === 'calc') {
        for (const dep of nodeObj.deps) {
            for (const a of findAtoms(dep, visited)) atoms.add(a)
        }
    } else if (nodeObj._type === 'iff') {
        for (const group of nodeObj.conditionGroups) {
            const cs = Array.isArray(group) ? group : [group]
            for (const c of cs) for (const a of findAtoms(c, visited)) atoms.add(a)
        }
        for (const out of nodeObj.outputs) {
            for (const a of findAtoms(out, visited)) atoms.add(a)
        }
    }

    visited.delete(node) // allow other branches to visit (they will hit the cache anyway)
    atomsCache.set(nodeObj, atoms)
    return atoms
}

// ─── Constructors ────────────────────────────────────────────────────────────

export function state<T>(initial: T): Atom<T> {
    return { _type: 'state', initial }
}

export function calc<D extends readonly unknown[], R>(
    fn: (...args: ResolvedDeps<D>) => R,
    deps: readonly [...D],
): Calc<R> {
    return { _type: 'calc', fn: fn as (...args: any[]) => R, deps }
}

export function set<T>(atom: Atom<T>, value: Val<T>): Update<T> {
    return { _type: 'set', atom, value }
}

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

type WatchEntry = {
    fn: (...args: any[]) => void
    deps: readonly unknown[]
    atoms: Set<Atom<any>>
}

export function run() {
    const store = new Map<Atom<any>, any>()
    const watchers = new Set<WatchEntry>()
    const watchersByAtom = new Map<Atom<any>, Set<WatchEntry>>()
    const calcCache = new WeakMap<Calc<any>, { depValues: unknown[]; result: any }>()
    const activeStack = new Set<unknown>()

    function resolve(node: unknown): unknown {
        if (node == null || typeof node !== 'object' || !('_type' in node)) return node

        if (activeStack.has(node)) {
            throw new Error(`Circular dependency detected: a node depends on itself.`)
        }
        activeStack.add(node)

        try {
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
                        if (conditions.every(c => !!resolve(c))) return resolve(n.outputs[i])
                    }
                    return resolve(n.outputs[n.conditionGroups.length])
                }
                default:
                    return node
            }
        } finally {
            activeStack.delete(node)
        }
    }

    function collectMuts(node: unknown): Update<any>[] {
        const v = resolve(node)
        if (Array.isArray(v)) return v.flatMap(collectMuts)
        if ((v as any)?._type === 'set') return [v as Update<any>]
        if (v !== node && (v as any)?._type) return collectMuts(v)
        return []
    }

    function send(action: Action): void {
        const muts = collectMuts(action)
        if (muts.length === 0) return

        // ① Determine which watchers could potentially be affected.
        //    Only watchers that depend on at least one atom being changed need checking.
        const candidates = new Set<WatchEntry>()
        const changedAtoms = new Set<Atom<any>>()
        for (const m of muts) {
            changedAtoms.add(m.atom)
            const dependants = watchersByAtom.get(m.atom)
            if (dependants) for (const w of dependants) candidates.add(w)
        }

        // ② Snapshot candidate deps BEFORE any write.
        const planned = [...candidates].map(w => ({ w, snap: w.deps.map(d => resolve(d)) }))

        // ③ Apply mutations atomically
        const values = muts.map(m => resolve(m.value))
        muts.forEach((m, i) => store.set(m.atom, values[i]))

        // ④ Notify candidates whose resolved values actually changed.
        for (const { w, snap } of planned) {
            if (!watchers.has(w)) continue
            const next = w.deps.map(d => resolve(d))
            if (next.some((v, j) => !Object.is(v, snap[j]))) w.fn(...next)
        }
    }

    function watch<D extends readonly unknown[]>(
        fn: (...args: ResolvedDeps<D>) => void,
        deps: readonly [...D],
    ): () => void {
        const entryAtoms = new Set<Atom<any>>()
        for (const d of deps) {
            for (const a of findAtoms(d)) entryAtoms.add(a)
        }

        const entry: WatchEntry = { fn: fn as (...args: any[]) => void, deps, atoms: entryAtoms }
        watchers.add(entry)

        for (const a of entryAtoms) {
            let set = watchersByAtom.get(a)
            if (!set) watchersByAtom.set(a, set = new Set())
            set.add(entry)
        }

        return () => {
            watchers.delete(entry)
            for (const a of entryAtoms) watchersByAtom.get(a)?.delete(entry)
        }
    }

    function get<T>(node: Val<T>): T {
        return resolve(node) as T
    }

    return { send, get, watch }
}
