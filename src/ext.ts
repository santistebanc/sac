import { state, set, calc } from './core.js'
import * as c from './calcs.js'
import type { Atom, Val, Update, Calc } from './core.js'

/**
 * Creates a "smarter" atom with a base set of methods (set, reset, eq, neq)
 * plus any additional methods provided by the extension function.
 */
function wrap<T, E>(initial: T, ext: (s: Atom<T>) => E) {
    const s = state(initial)
    const base = {
        set: (v: Val<T>) => set(s, v),
        reset: () => set(s, s.start),
        initial: () => set(s, s.start),
        eq: (v: Val<T>) => c.eq(s, v as any),
        neq: (v: Val<T>) => c.neq(s, v as any),
    }
    return Object.assign(s, base, ext(s))
}

// ─── Number ───────────────────────────────────────────────────────────────────

export const num = (initial: number) => wrap(initial, s => ({
    inc: () => set(s, c.add(s, 1)),
    dec: () => set(s, c.sub(s, 1)),
    add: (v: Val<number>) => c.add(s, v),
    sub: (v: Val<number>) => c.sub(s, v),
    mul: (v: Val<number>) => c.mul(s, v),
    div: (v: Val<number>) => c.div(s, v),
    mod: (v: Val<number>) => c.mod(s, v),
    pow: (v: Val<number>) => c.pow(s, v),
    neg: () => c.neg(s),
    abs: () => c.abs(s),
    lt: (v: Val<number>) => c.lt(s, v),
    lte: (v: Val<number>) => c.lte(s, v),
    gt: (v: Val<number>) => c.gt(s, v),
    gte: (v: Val<number>) => c.gte(s, v),
    min: (v: Val<number>) => c.min(s, v),
    max: (v: Val<number>) => c.max(s, v),
    sum: (...vs: Val<number>[]) => c.sum(s, ...vs),
    clamp: (lo: Val<number>, hi: Val<number>) => c.max(lo, c.min(s, hi)),
    floor: () => c.floor(s),
    ceil: () => c.ceil(s),
    round: () => c.round(s),
}))

// ─── String ───────────────────────────────────────────────────────────────────

export const text = (initial: string) => wrap(initial, s => ({
    concat: (...args: Val<string>[]) => c.concat(s, ...args),
    includes: (search: Val<string>) => c.includes(s, search),
    length: () => c.length(s),
    toUpper: () => c.toUpper(s),
    toLower: () => c.toLower(s),
    trim: () => c.trim(s),
    split: (sep: Val<string>) => c.split(s, sep),
    slice: (start: Val<number>, end?: Val<number>) => c.slice(s, start, end),
    replace: (pattern: Val<string | RegExp>, replacement: Val<string>) => c.replace(s, pattern, replacement),
    startsWith: (search: Val<string>) => c.startsWith(s, search),
    endsWith: (search: Val<string>) => c.endsWith(s, search),
}))

// ─── Boolean ──────────────────────────────────────────────────────────────────

export const bool = (initial: boolean) => wrap(initial, s => ({
    toggle: () => set(s, c.not(s)),
    not: () => c.not(s),
    and: (...args: Val<unknown>[]) => c.and(s, ...args),
    or: (...args: Val<unknown>[]) => c.or(s, ...args),
}))

// ─── List (Array) ─────────────────────────────────────────────────────────────

export const list = <T>(initial: T[]) => wrap(initial, s => ({
    push: (item: Val<T>) => set(s, c.concat(s, [item] as any) as any),
    pop: () => set(s, c.slice(s, 0, -1) as any),
    unshift: (item: Val<T>) => set(s, c.concat([item] as any, s as any) as any),
    shift: () => set(s, c.slice(s, 1) as any),
    remove: (item: Val<T>) => set(s, c.filter(s, (x: any) => x !== item)),
    clear: () => set(s, []),
    at: (index: Val<number>) => c.at(s, index),
    length: () => c.length(s),
    includes: (item: Val<T>) => c.includes(s, item),
    join: (sep: Val<string>) => c.join(s, sep),

    // Functional read methods
    map: <U>(fn: (item: T, index: number) => U) => c.map(s, fn),
    filter: (fn: (item: T, index: number) => boolean) => c.filter(s, fn),
    reduce: <U>(fn: (acc: U, item: T, index: number) => U, init: U) => c.reduce(s, fn, init),
    find: (fn: (item: T, index: number) => boolean) => c.find(s, fn),
    some: (fn: (item: T, index: number) => boolean) => c.some(s, fn),
    every: (fn: (item: T, index: number) => boolean) => c.every(s, fn),
    intersect: (other: Val<T[]>) => c.intersect(s, other),
}))

// ─── Record (Object) ──────────────────────────────────────────────────────────

export const record = <T extends object>(initial: T) => wrap(initial, s => ({
    put: <K extends keyof T>(key: K, value: Val<T[K]>) => set(s, calc((curr, v) => ({ ...curr as any, [key]: v }), [s, value])),
    patch: (p: Val<Partial<T>>) => set(s, calc((curr, p) => ({ ...curr as any, ...p as any }), [s, p])),
    at: <K extends keyof T>(key: K) => c.at(s, key),
    keys: () => c.keys(s),
    values: () => c.values(s),
    entries: () => c.entries(s),
}))

// ─── Unique List (Collection) ─────────────────────────────────────────────────

export const collection = <T>(initial: T[]) => wrap([...new Set(initial)], s => ({
    add: (item: Val<T>) => set(s, calc((v: any, i: any) => v.includes(i) ? v : [...v, i], [s, item])),
    remove: (item: Val<T>) => set(s, calc((v: any, i: any) => v.filter((x: any) => x !== i), [s, item])),
    has: (item: Val<T>) => c.includes(s, item),
    clear: () => set(s, []),
    size: () => c.length(s),

    intersect: (other: Val<T[]>) => c.intersect(s, other),
    union: (other: Val<T[]>) => c.union(s, other),
    difference: (other: Val<T[]>) => c.difference(s, other),
}))

// ─── Enum (Choice) ────────────────────────────────────────────────────────────

export function choice<T extends string>(...options: T[]) {
    return wrap(options[0], s => {
        const setTo = {} as Record<T, Update<T>>
        const is = {} as Record<T, Calc<boolean>>
        const isNot = {} as Record<T, Calc<boolean>>

        for (const opt of options) {
            setTo[opt] = set(s, opt)
            is[opt] = c.eq(s, opt)
            isNot[opt] = c.neq(s, opt)
        }

        return { setTo, is, isNot, options }
    })
}
