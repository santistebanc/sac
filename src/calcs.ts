import { calc } from './core.js'
import type { Val } from './core.js'

// ─── Comparison ───────────────────────────────────────────────────────────────

export const eq = (a: Val<unknown>, b: Val<unknown>) => calc((a, b) => a === b, [a, b])
export const neq = (a: Val<unknown>, b: Val<unknown>) => calc((a, b) => a !== b, [a, b])
export const lt = (a: Val<number>, b: Val<number>) => calc((a, b) => a < b, [a, b])
export const lte = (a: Val<number>, b: Val<number>) => calc((a, b) => a <= b, [a, b])
export const gt = (a: Val<number>, b: Val<number>) => calc((a, b) => a > b, [a, b])
export const gte = (a: Val<number>, b: Val<number>) => calc((a, b) => a >= b, [a, b])

// ─── Arithmetic ───────────────────────────────────────────────────────────────

export const add = (a: Val<number>, b: Val<number>) => calc((a, b) => a + b, [a, b])
export const sub = (a: Val<number>, b: Val<number>) => calc((a, b) => a - b, [a, b])
export const mul = (a: Val<number>, b: Val<number>) => calc((a, b) => a * b, [a, b])
export const div = (a: Val<number>, b: Val<number>) => calc((a, b) => a / b, [a, b])
export const mod = (a: Val<number>, b: Val<number>) => calc((a, b) => a % b, [a, b])
export const pow = (a: Val<number>, b: Val<number>) => calc((a, b) => a ** b, [a, b])
export const neg = (a: Val<number>) => calc((a) => -a, [a])
export const abs = (a: Val<number>) => calc((a) => Math.abs(a), [a])
export const floor = (a: Val<number>) => calc((a) => Math.floor(a), [a])
export const ceil = (a: Val<number>) => calc((a) => Math.ceil(a), [a])
export const round = (a: Val<number>) => calc((a) => Math.round(a), [a])

// ─── Aggregation ──────────────────────────────────────────────────────────────

/** Sum any number of resolvable numbers. */
export const sum = (...args: Val<number>[]) => calc((...vs) => vs.reduce((a, b) => a + b, 0), args)
export const min = (...args: Val<number>[]) => calc((...vs) => Math.min(...vs), args)
export const max = (...args: Val<number>[]) => calc((...vs) => Math.max(...vs), args)

// ─── Logic ────────────────────────────────────────────────────────────────────

export const not = (a: Val<unknown>) => calc((a) => !a, [a])
export const and = (...args: Val<unknown>[]) => calc((...vs) => vs.every(Boolean), args)
export const or = (...args: Val<unknown>[]) => calc((...vs) => vs.some(Boolean), args)

// ─── String ───────────────────────────────────────────────────────────────────

export const concat = (...args: Val<any>[]) => calc((...vs) => vs.reduce((a, b) => a.concat(b)), args)
export const includes = (a: Val<any>, search: Val<any>) => calc((a, s) => a.includes(s), [a, search])
export const length = (a: Val<any[] | string>) => calc(v => v.length, [a])
export const at = (a: Val<any[] | object>, key: Val<any>) => calc((v, k) => (v as any)[k as any], [a, key])

export const toUpper = (a: Val<string>) => calc(v => String(v).toUpperCase(), [a])
export const toLower = (a: Val<string>) => calc(v => String(v).toLowerCase(), [a])
export const trim = (a: Val<string>) => calc(v => String(v).trim(), [a])
export const split = (a: Val<string>, sep: Val<string>) => calc((v, s) => String(v).split(s as string), [a, sep])
export const slice = (a: Val<any[] | string>, start: Val<number>, end?: Val<number>) => calc((v, st, en) => (v as any).slice(st, en), [a, start, end])
export const replace = (a: Val<string>, p: Val<string | RegExp>, r: Val<string>) => calc((v, p, r) => String(v).replace(p as any, r as string), [a, p, r])
export const startsWith = (a: Val<string>, s: Val<string>) => calc((v, s) => String(v).startsWith(s as string), [a, s])
export const endsWith = (a: Val<string>, s: Val<string>) => calc((v, s) => String(v).endsWith(s as string), [a, s])

// ─── List & Collection ────────────────────────────────────────────────────────

export const map = <T, U>(a: Val<T[]>, fn: (item: T, index: number) => U) => calc((v: T[]) => v.map(fn), [a])
export const filter = <T>(a: Val<T[]>, fn: (item: T, index: number) => boolean) => calc((v: T[]) => v.filter(fn), [a])
export const reduce = <T, U>(a: Val<T[]>, fn: (acc: U, item: T, index: number) => U, init: U) => calc((v: T[]) => v.reduce(fn, init), [a])
export const find = <T>(a: Val<T[]>, fn: (item: T, index: number) => boolean) => calc((v: T[]) => v.find(fn), [a])
export const some = <T>(a: Val<T[]>, fn: (item: T, index: number) => boolean) => calc((v: T[]) => v.some(fn), [a])
export const every = <T>(a: Val<T[]>, fn: (item: T, index: number) => boolean) => calc((v: T[]) => v.every(fn), [a])
export const join = (a: Val<any[]>, sep: Val<string>) => calc((v, s) => v.join(s), [a, sep])

export const intersect = <T>(a: Val<T[]>, b: Val<T[]>) => calc((v, ot) => v.filter(x => ot.includes(x)), [a, b])
export const union = <T>(a: Val<T[]>, b: Val<T[]>) => calc((v, ot) => [...new Set([...v, ...ot])], [a, b])
export const difference = <T>(a: Val<T[]>, b: Val<T[]>) => calc((v, ot) => v.filter(x => !ot.includes(x)), [a, b])

// ─── Record ───────────────────────────────────────────────────────────────────

export const keys = (a: Val<object>) => calc(v => Object.keys(v), [a])
export const values = (a: Val<object>) => calc(v => Object.values(v), [a])
export const entries = (a: Val<object>) => calc(v => Object.entries(v), [a])
