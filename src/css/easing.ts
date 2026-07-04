/**
 * CSS easing functions: keywords, cubic-bezier(), and steps().
 *
 * An easing maps segment progress t ∈ [0, 1] to eased progress. Keyframe
 * animations apply it per segment; transitions over their single segment.
 */

export type Easing = (t: number) => number

const KEYWORD_CONTROL_POINTS: Record<string, [number, number, number, number]> = {
    'ease': [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
}

/** Parse a CSS easing value; null when the value is not a valid easing. */
export function parseEasing(value: string): Easing | null {
    const trimmed = value.trim()
    if (trimmed === 'linear') return t => t
    if (trimmed === 'step-start') return steps(1, 'start')
    if (trimmed === 'step-end') return steps(1, 'end')
    const preset = KEYWORD_CONTROL_POINTS[trimmed]
    if (preset) return cubicBezier(...preset)
    if (trimmed.startsWith('cubic-bezier(')) return parseCubicBezier(trimmed)
    if (trimmed.startsWith('steps(')) return parseSteps(trimmed)
    return null
}

function parseCubicBezier(value: string): Easing | null {
    const args = functionArguments(value, 'cubic-bezier')
    if (args === null || args.length !== 4) return null
    const numbers = args.map(Number)
    if (numbers.some(isNaN)) return null
    const [x1, y1, x2, y2] = numbers
    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null
    return cubicBezier(x1, y1, x2, y2)
}

function parseSteps(value: string): Easing | null {
    const args = functionArguments(value, 'steps')
    if (args === null || args.length < 1 || args.length > 2) return null
    const count = parseInt(args[0], 10)
    if (isNaN(count) || count <= 0 || String(count) !== args[0]) return null
    const position = args[1] ?? 'end'
    if (!['start', 'end', 'jump-start', 'jump-end'].includes(position)) return null
    return steps(count, position.endsWith('start') ? 'start' : 'end')
}

/** The comma-separated arguments of `name(...)`, or null if malformed. */
function functionArguments(value: string, name: string): string[] | null {
    if (!value.startsWith(`${name}(`) || !value.endsWith(')')) return null
    return value.slice(name.length + 1, -1).split(',').map(s => s.trim())
}

function steps(count: number, position: 'start' | 'end'): Easing {
    return t => {
        if (t >= 1) return 1
        const step = position === 'start' ? Math.ceil(t * count) : Math.floor(t * count)
        return Math.min(step / count, 1)
    }
}

/**
 * A CSS cubic bezier: fixed endpoints (0,0) and (1,1) with the given
 * control points. Evaluated by solving x(s) = t for the curve parameter s
 * (bisection — x is monotone since x1, x2 ∈ [0, 1]), then reading y(s).
 */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
    const sample = (p1: number, p2: number, s: number): number => {
        const inv = 1 - s
        return 3 * inv * inv * s * p1 + 3 * inv * s * s * p2 + s * s * s
    }
    return t => {
        if (t <= 0) return 0
        if (t >= 1) return 1
        let low = 0
        let high = 1
        for (let i = 0; i < 32; i++) {
            const mid = (low + high) / 2
            if (sample(x1, x2, mid) < t) low = mid
            else high = mid
        }
        return sample(y1, y2, (low + high) / 2)
    }
}
