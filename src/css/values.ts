import type { ResolvedStyle } from './compute.js'

/** A number with the cell unit or its browser-CSS alias ch (one character width). */
const CELL_LENGTH = /^([+-]?(?:\d+\.?\d*|\.\d+))(cell|ch)$/

/**
 * Parse a length in cells, returning the unrounded number, or null when the
 * value is not a cell/ch length (keywords like `stretch` end in "ch" too).
 */
export function parseCellLength(value: string): number | null {
    const match = CELL_LENGTH.exec(value.trim())
    return match ? parseFloat(match[1]) : null
}

/**
 * Parse a cell value from CSS. Accepts:
 * - `5cell` / `5ch` → 5
 * - `0` → 0 (unitless zero is valid CSS)
 * - Returns 0 for unrecognised values (browser-only units like px, em, rem)
 */
export function parseCellValue(value: string): number {
    if (value === '0') return 0
    const length = parseCellLength(value)
    return length === null ? 0 : Math.round(length)
}

export function parseSizeValue(value: string): number | string | null {
    if (value === 'auto') return null
    if (value.endsWith('%')) return value
    // Preserve calc/min/max/clamp expressions as strings for layout-time evaluation
    if (value.startsWith('calc(') || value.startsWith('min(') || value.startsWith('max(') || value.startsWith('clamp(')) {
        return value
    }
    return parseCellValue(value)
}

export function parseJustify(value: string): ResolvedStyle['justifyContent'] {
    const map: Record<string, ResolvedStyle['justifyContent']> = {
        'flex-start': 'start', 'start': 'start',
        'flex-end': 'end', 'end': 'end',
        'center': 'center',
        'space-between': 'space-between',
        'space-around': 'space-around',
        'space-evenly': 'space-evenly',
    }
    return map[value] ?? 'start'
}

export function parseAlign(value: string): ResolvedStyle['alignItems'] {
    const map: Record<string, ResolvedStyle['alignItems']> = {
        'flex-start': 'start', 'start': 'start',
        'flex-end': 'end', 'end': 'end',
        'center': 'center', 'stretch': 'stretch',
    }
    return map[value] ?? 'start'
}

export function parsePadding(value: string): { top: number; right: number; bottom: number; left: number } {
    const parts = value.split(/\s+/).map(parseCellValue)
    if (parts.length === 1) {
        return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] }
    }
    if (parts.length === 2) {
        return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] }
    }
    if (parts.length === 3) {
        return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] }
    }
    return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] }
}
