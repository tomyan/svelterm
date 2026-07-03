/**
 * Value interpolation for animations and transitions. Colours mix in RGB
 * space; endpoints are returned exactly so ANSI palette names survive at
 * t=0 and t=1.
 */

/** Nominal xterm palette values for the SGR colour names we emit. */
const ANSI_RGB: Record<string, [number, number, number]> = {
    black: [0, 0, 0], red: [205, 0, 0], green: [0, 205, 0], yellow: [205, 205, 0],
    blue: [0, 0, 238], magenta: [205, 0, 205], cyan: [0, 205, 205], white: [229, 229, 229],
}

/**
 * Mix two resolved colours (SGR names or #rrggbb) at t ∈ [0,1].
 * Returns null when either endpoint has no RGB value (`default`) —
 * callers fall back to a discrete switch.
 */
export function lerpColor(from: string, to: string, t: number): string | null {
    if (t <= 0) return from
    if (t >= 1) return to
    const a = colorToRgb(from)
    const b = colorToRgb(to)
    if (!a || !b) return null
    const channels = a.map((channel, i) => Math.round(channel + (b[i] - channel) * t))
    return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('')
}

/** Linear interpolation rounded to whole cells. */
export function lerpNumber(from: number, to: number, t: number): number {
    return Math.round(from + (to - from) * t)
}

function colorToRgb(color: string): [number, number, number] | null {
    if (color.startsWith('#') && color.length >= 7) {
        return [
            parseInt(color.slice(1, 3), 16),
            parseInt(color.slice(3, 5), 16),
            parseInt(color.slice(5, 7), 16),
        ]
    }
    return ANSI_RGB[color] ?? null
}
