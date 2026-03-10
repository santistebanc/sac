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

export function family<K, T>(create: (key: K) => T): (key: K) => T {
    const cache = new Map<K, T>()
    return (key: K) => {
        let value = cache.get(key)
        if (value === undefined && !cache.has(key)) {
            value = create(key)
            cache.set(key, value)
        }
        return value as T
    }
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

export type WatchUnsubscribe = () => void
export type OnHandler = () => void | (() => void)
export type ExitHandler = () => void
export type OnCondition = Val<boolean> | readonly Val<boolean>[]
export type CommitUnsubscribe = () => void

export interface CommittedUpdate<T = unknown> {
    readonly _type: 'set'
    atom: Atom<T>
    value: T
}

type CommitHandler = (updates: readonly CommittedUpdate[]) => void

export interface OnRegistration {
    (): void
    exit(handler: ExitHandler): OnRegistration
}

export interface Runtime {
    send(action: Action): void
    get<T>(node: Val<T>): T
    watch<T>(
        fn: (value: ResolveOne<T>) => void,
        dep: T,
    ): WatchUnsubscribe
    watch<D extends readonly unknown[]>(
        fn: (...args: ResolvedDeps<D>) => void,
        deps: readonly [...D],
    ): WatchUnsubscribe
    onCommit(handler: CommitHandler): CommitUnsubscribe
    on(condition: OnCondition): (handler: OnHandler) => OnRegistration
}

type OnEntry = {
    condition: OnCondition
    handler: OnHandler
    active: boolean
    cleanup?: () => void
    disposed: boolean
    exitHandlers: Set<ExitHandler>
}

export function run(): Runtime
export function run(initialUpdates: readonly Update<any>[]): Runtime
export function run(initialUpdates: readonly CommittedUpdate[]): Runtime
export function run(initialUpdates: readonly (Update<any> | CommittedUpdate)[] = []): Runtime {
    const store = new Map<Atom<any>, any>()
    const watchers = new Set<WatchEntry>()
    const commitHandlers = new Set<CommitHandler>()
    const watchersByAtom = new Map<Atom<any>, Set<WatchEntry>>()
    const calcCache = new WeakMap<Calc<any>, { depValues: unknown[]; result: any }>()
    const activeStack = new Set<unknown>()
    const onEntries = new Set<OnEntry>()
    let reconcilingOns = false
    let pendingOnReconcile = false

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

    function resolveOnCondition(condition: OnCondition): boolean {
        if (Array.isArray(condition)) return condition.every(item => !!resolve(item))
        return !!resolve(condition)
    }

    function applyResolvedMutations(muts: readonly Update<any>[]): CommittedUpdate[] {
        const values = muts.map(m => deepFreeze(resolve(m.value)))
        muts.forEach((m, i) => store.set(m.atom, values[i]))
        return muts.map((m, i) => ({
            _type: 'set',
            atom: m.atom,
            value: values[i],
        }))
    }

    function deactivateOn(entry: OnEntry, notifyExitHandlers: boolean): void {
        if (!entry.active) return
        entry.active = false
        const cleanup = entry.cleanup
        entry.cleanup = undefined
        cleanup?.()
        if (notifyExitHandlers) {
            for (const exitHandler of entry.exitHandlers) exitHandler()
        }
    }

    function disposeOn(entry: OnEntry): void {
        if (entry.disposed) return
        entry.disposed = true
        onEntries.delete(entry)
        deactivateOn(entry, false)
    }

    function reconcileOns(): void {
        if (reconcilingOns) {
            pendingOnReconcile = true
            return
        }

        reconcilingOns = true
        try {
            do {
                pendingOnReconcile = false

                for (const entry of [...onEntries]) {
                    if (entry.disposed || !onEntries.has(entry)) continue

                    const shouldBeActive = resolveOnCondition(entry.condition)
                    if (shouldBeActive === entry.active) continue

                    if (shouldBeActive) {
                        entry.active = true
                        entry.cleanup = undefined

                        try {
                            const cleanup = entry.handler()
                            if (typeof cleanup === 'function') entry.cleanup = cleanup
                        } catch (error) {
                            entry.active = false
                            entry.cleanup = undefined
                            throw error
                        }
                    } else {
                        deactivateOn(entry, true)
                    }
                }
            } while (pendingOnReconcile)
        } finally {
            reconcilingOns = false
        }
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

        const committed = applyResolvedMutations(muts)

        for (const handler of [...commitHandlers]) {
            if (commitHandlers.has(handler)) handler(committed)
        }

        // Notify if values changed
        for (const { w, snap } of planned) {
            if (!watchers.has(w)) continue
            const next = w.deps.map(resolve)
            if (next.some((v, j) => !Object.is(v, snap[j]))) w.fn(...next)
        }

        reconcileOns()
    }

    function watch<T>(
        fn: (value: ResolveOne<T>) => void,
        dep: T,
    ): WatchUnsubscribe
    function watch<D extends readonly unknown[]>(
        fn: (...args: ResolvedDeps<D>) => void,
        deps: readonly [...D],
    ): WatchUnsubscribe
    function watch(
        fn: (...args: any[]) => void,
        depOrDeps: unknown,
    ): WatchUnsubscribe {
        const deps = Array.isArray(depOrDeps) ? depOrDeps : [depOrDeps]
        const entryAtoms = new Set<Atom<any>>()
        for (const d of deps) {
            for (const a of findAtoms(d)) entryAtoms.add(a)
        }

        const entry: WatchEntry = { fn, deps, atoms: entryAtoms }
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

    function onCommit(handler: CommitHandler): CommitUnsubscribe {
        commitHandlers.add(handler)
        return () => {
            commitHandlers.delete(handler)
        }
    }

    function on(condition: OnCondition) {
        return (handler: OnHandler): OnRegistration => {
            const entry: OnEntry = {
                condition,
                handler,
                active: false,
                disposed: false,
                exitHandlers: new Set(),
            }

            onEntries.add(entry)
            reconcileOns()

            const registration = (() => {
                disposeOn(entry)
            }) as OnRegistration

            registration.exit = (exitHandler: ExitHandler) => {
                entry.exitHandlers.add(exitHandler)
                return registration
            }

            return registration
        }
    }

    const initialMuts = collectMuts(initialUpdates)
    if (initialMuts.length > 0) {
        applyResolvedMutations(initialMuts)
    }

    return {
        send,
        get: <T>(node: Val<T>) => resolve(node) as T,
        watch,
        onCommit,
        on,
    }
}
