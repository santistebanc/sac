import { state, set, calc } from './core.js'
import {
    eq, neq, lt, lte, gt, gte,
    add, sub, mul, div, mod, pow, neg, abs,
    sum, min, max,
    not, and, or,
    concat, includes, length, at
} from './calcs.js'
import type { Atom, Val, Action, Calc, Update } from './core.js'

/** Create a "smarter" atom that knows how to manipulate itself. */
function wrap<T, E>(initial: T, ext: (s: Atom<T>) => E) {
    const s = state(initial)
    return Object.assign(s, ext(s))
}

// ─── Number ───────────────────────────────────────────────────────────────────

export const num = (initial: number) => wrap(initial, s => ({
    set: (v: Val<number>) => set(s, v),
    reset: () => set(s, s.initial),
    default: () => set(s, s.initial),
    inc: () => set(s, add(s, 1)),
    dec: () => set(s, sub(s, 1)),
    add: (v: Val<number>) => add(s, v),
    sub: (v: Val<number>) => sub(s, v),
    mul: (v: Val<number>) => mul(s, v),
    div: (v: Val<number>) => div(s, v),
    mod: (v: Val<number>) => mod(s, v),
    pow: (v: Val<number>) => pow(s, v),
    neg: () => neg(s),
    abs: () => abs(s),
    lt: (v: Val<number>) => lt(s, v),
    lte: (v: Val<number>) => lte(s, v),
    gt: (v: Val<number>) => gt(s, v),
    gte: (v: Val<number>) => gte(s, v),
    eq: (v: Val<number>) => eq(s, v),
    neq: (v: Val<number>) => neq(s, v),
    min: (v: Val<number>) => min(s, v),
    max: (v: Val<number>) => max(s, v),
    sum: (...vs: Val<number>[]) => sum(s, ...vs),
    clamp: (lo: Val<number>, hi: Val<number>) => max(lo, min(s, hi)),
}))

// ─── String ───────────────────────────────────────────────────────────────────

export const text = (initial: string) => wrap(initial, s => ({
    set: (v: Val<string>) => set(s, v),
    reset: () => set(s, s.initial),
    default: () => set(s, s.initial),
    concat: (...args: Val<string>[]) => concat(s, ...args),
    includes: (search: Val<string>) => includes(s, search),
    eq: (v: Val<string>) => eq(s, v),
    neq: (v: Val<string>) => neq(s, v),
}))

// ─── Boolean ──────────────────────────────────────────────────────────────────

export const bool = (initial: boolean) => wrap(initial, s => ({
    set: (v: Val<boolean>) => set(s, v),
    reset: () => set(s, s.initial),
    default: () => set(s, s.initial),
    toggle: () => set(s, not(s)),
    not: () => not(s),
    and: (...args: Val<unknown>[]) => and(s, ...args),
    or: (...args: Val<unknown>[]) => or(s, ...args),
    eq: (v: Val<boolean>) => eq(s, v),
    neq: (v: Val<boolean>) => neq(s, v),
}))

// ─── List (Array) ─────────────────────────────────────────────────────────────

export const list = <T>(initial: T[]) => wrap(initial, s => ({
    set: (v: Val<T[]>) => set(s, v),
    reset: () => set(s, s.initial),
    default: () => set(s, s.initial),
    push: (item: Val<T>) => set(s, concat(s, [item] as any)),
    pop: () => set(s, calc((v: T[]) => v.slice(0, -1), [s])),
    remove: (item: Val<T>) => set(s, calc((list: any[], i: any) => list.filter(x => x !== i), [s, item])),
    at: (index: Val<number>) => at(s, index),
    length: () => length(s),
    includes: (item: Val<T>) => includes(s, item),
}))

// ─── Enum (Choice) ────────────────────────────────────────────────────────────

export function choice<T extends string>(...options: T[]) {
    const s = state(options[0])

    const setTo = {} as Record<T, Update<T>>
    const is = {} as Record<T, Calc<boolean>>
    const isNot = {} as Record<T, Calc<boolean>>

    for (const opt of options) {
        setTo[opt] = set(s, opt)
        is[opt] = eq(s, opt)
        isNot[opt] = neq(s, opt)
    }

    return Object.assign(s, {
        set: (v: Val<T>) => set(s, v),
        eq: (v: Val<T>) => eq(s, v),
        neq: (v: Val<T>) => neq(s, v),
        setTo,
        is,
        isNot,
        reset: () => set(s, s.initial),
        default: () => set(s, s.initial),
        options,
    })
}
