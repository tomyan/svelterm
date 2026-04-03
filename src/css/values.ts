import type { ResolvedStyle } from './compute.js'

/**
 * Parse a cell value from CSS. Accepts:
 * - `5cell` → 5
 * - `0` → 0 (unitless zero is valid CSS)
 * - Returns 0 for unrecognised values (browser-only units like px, em, rem)
 */
export function parseCellValue(value: string): number {
    if (value === '0') return 0
    if (value.endsWith('cell')) {
        const num = parseFloat(value)
        return isNaN(num) ? 0 : Math.round(num)
    }
    return 0
}

export function parseSizeValue(value: string): number | string | null {
    if (value === 'auto') return null
    if (value.endsWith('%')) return value
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
