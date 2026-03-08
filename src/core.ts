// ─── Utility types ──────────────────────────────────────────────────────────

/** Deeply freeze an object to prevent mutation. */
function deepFreeze<T>(obj: T): T {
    if (obj == null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj
    const props = Object.getOwnPropertyNames(obj)
    for (const name of props) {
        const value = (obj as any)[name]
        if (value && typeof value === 'object') deepFreeze(value)
    }
    return Object.freeze(obj)
}

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
    readonly start: T
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
    const type = nodeObj._type
    if (!type || visited.has(node)) return new Set()

    visited.add(node)
    const atoms = new Set<Atom<any>>()

    switch (type) {
        case 'state':
            atoms.add(nodeObj)
            break
        case 'calc':
            for (const dep of nodeObj.deps) {
                for (const a of findAtoms(dep, visited)) atoms.add(a)
            }
            break
        case 'iff':
            for (const group of nodeObj.conditionGroups) {
                const cs = Array.isArray(group) ? group : [group]
                for (const c of cs) for (const a of findAtoms(c, visited)) atoms.add(a)
            }
            for (const out of nodeObj.outputs) {
                for (const a of findAtoms(out, visited)) atoms.add(a)
            }
            break
    }

    visited.delete(node)
    atomsCache.set(nodeObj, atoms)
    return atoms
}

// ─── Constructors ────────────────────────────────────────────────────────────

export function state<T>(initial: T): Atom<T> {
    return { _type: 'state', start: deepFreeze(initial) }
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
            const n = node as any
            switch (n._type) {
                case 'state': {
                    if (!store.has(n)) store.set(n, n.start)
                    return store.get(n)
                }
                case 'calc': {
                    const args = n.deps.map(resolve)
                    const cached = calcCache.get(n)
                    if (cached && cached.depValues.every((v, i) => Object.is(v, args[i]))) {
                        return cached.result
                    }
                    const result = deepFreeze(n.fn(...args))
                    calcCache.set(n, { depValues: args, result })
                    return result
                }
                case 'iff': {
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

        const candidates = new Set<WatchEntry>()
        for (const m of muts) {
            const dependants = watchersByAtom.get(m.atom)
            if (dependants) for (const w of dependants) candidates.add(w)
        }

        // Snapshot candidates before applying mutations
        const planned = [...candidates].map(w => ({ w, snap: w.deps.map(resolve) }))

        // Resolve all values first (atomicity)
        const values = muts.map(m => deepFreeze(resolve(m.value)))

        // Apply mutations
        muts.forEach((m, i) => store.set(m.atom, values[i]))

        // Notify if values changed
        for (const { w, snap } of planned) {
            if (!watchers.has(w)) continue
            const next = w.deps.map(resolve)
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

    return {
        send,
        get: <T>(node: Val<T>) => resolve(node) as T,
        watch,
    }
}
