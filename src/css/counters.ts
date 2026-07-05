/**
 * CSS counters for `content: counter(name)` — threaded through the
 * style-resolution walk, which visits elements in document order.
 * Flat namespace (no per-scope nesting or `counters()` joining yet);
 * incremental restyles reuse the values from the last full resolve.
 */

import type { ResolvedStyle } from './compute.js'

export class CounterContext {
    private values = new Map<string, number>()

    /** Apply an element's counter-reset then counter-increment. */
    enter(style: ResolvedStyle): void {
        if (style.counterReset) {
            for (const { name, amount } of parseCounterList(style.counterReset, 0)) {
                this.values.set(name, amount)
            }
        }
        if (style.counterIncrement) {
            for (const { name, amount } of parseCounterList(style.counterIncrement, 1)) {
                this.values.set(name, (this.values.get(name) ?? 0) + amount)
            }
        }
    }

    value(name: string): number {
        return this.values.get(name) ?? 0
    }
}

/** Parse `name [amount] name [amount] …` with a per-property default. */
function parseCounterList(value: string, defaultAmount: number): Array<{ name: string; amount: number }> {
    const out: Array<{ name: string; amount: number }> = []
    const tokens = value.trim().split(/\s+/)
    for (let i = 0; i < tokens.length; i++) {
        const name = tokens[i]
        const next = tokens[i + 1]
        if (next !== undefined && /^-?\d+$/.test(next)) {
            out.push({ name, amount: parseInt(next, 10) })
            i++
        } else {
            out.push({ name, amount: defaultAmount })
        }
    }
    return out
}
