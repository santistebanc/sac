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

// ─── Aggregation ──────────────────────────────────────────────────────────────

/** Sum any number of resolvable numbers. */
export const sum = (...args: Val<number>[]) => calc((...vs) => vs.reduce((a, b) => a + b, 0), args)
export const min = (...args: Val<number>[]) => calc((...vs) => Math.min(...vs), args)
export const max = (...args: Val<number>[]) => calc((...vs) => Math.max(...vs), args)

// ─── Logic ────────────────────────────────────────────────────────────────────

export const not = (a: Val<unknown>) => calc((a) => !a, [a])
export const and = (...args: Val<unknown>[]) => calc((...vs) => vs.every(Boolean), args)
export const or = (...args: Val<unknown>[]) => calc((...vs) => vs.some(Boolean), args)

// ─── String & Array ───────────────────────────────────────────────────────────

export const concat = (...args: Val<any>[]) => calc((...vs) => vs.reduce((a, b) => a.concat(b)), args)
export const includes = (a: Val<any>, search: Val<any>) => calc((a, s) => a.includes(s), [a, search])
export const length = (a: Val<any[] | string>) => calc(v => v.length, [a])
export const at = (a: Val<any[] | string>, index: Val<number>) => calc((v, i) => v[i], [a, index])
