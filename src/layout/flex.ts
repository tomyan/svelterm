import { ResolvedStyle } from '../css/compute.js'

export function computeMainStart(
    justify: ResolvedStyle['justifyContent'],
    freeSpace: number,
    count: number,
    hasGrow: boolean,
): number {
    if (hasGrow || count === 0) return 0
    switch (justify) {
        case 'end': return Math.max(0, freeSpace)
        case 'center': return Math.floor(freeSpace / 2) // allows negative for overflow
        case 'space-around': return freeSpace > 0 ? Math.floor(freeSpace / (count * 2)) : 0
        case 'space-evenly': return freeSpace > 0 ? Math.floor(freeSpace / (count + 1)) : 0
        default: return 0
    }
}

export function computeItemGap(
    justify: ResolvedStyle['justifyContent'],
    gap: number,
    freeSpace: number,
    count: number,
    hasGrow: boolean,
): number {
    if (hasGrow) return gap
    if (count <= 1) return 0

    switch (justify) {
        case 'space-between': return Math.floor(freeSpace / (count - 1))
        case 'space-around': return Math.floor(freeSpace / count)
        case 'space-evenly': return Math.floor(freeSpace / (count + 1))
        default: return gap
    }
}

export function computeCrossOffset(
    align: ResolvedStyle['alignItems'],
    crossAvail: number,
    crossSize: number,
): number {
    switch (align) {
        case 'end': return crossAvail - crossSize
        case 'center': return Math.floor((crossAvail - crossSize) / 2)
        default: return 0
    }
}
