export function resolveSize(value: number | string | null | undefined, available: number): number | null {
    if (value === null || value === undefined) return null
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.endsWith('%')) {
        return Math.floor(available * parseFloat(value) / 100)
    }
    return null
}

export function constrain(value: number, min: number | null | undefined, max: number | null | undefined): number {
    let result = value
    if (min != null) result = Math.max(result, min)
    if (max != null) result = Math.min(result, max)
    return result
}
