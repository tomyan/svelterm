import type { ResolvedStyle } from './compute.js'

export function parseCellValue(value: string): number {
    const stripped = value.replace(/px$/, '')
    const num = parseFloat(stripped)
    return isNaN(num) ? 0 : Math.round(num)
}

export function parseSizeValue(value: string): number | string | null {
    if (value === 'auto') return null
    if (value.endsWith('%')) return value
    return parseCellValue(value.replace(/px$/, ''))
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
