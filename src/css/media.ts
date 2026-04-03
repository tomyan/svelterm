export interface MediaContext {
    colorScheme: 'dark' | 'light'
    displayMode: 'terminal' | 'screen'
    width: number
    height: number
}

/**
 * Evaluate a media query condition against the current context.
 * Supports: single conditions, "and" compound, "not" prefix.
 */
export function evaluateMediaQuery(condition: string, context: MediaContext): boolean {
    const trimmed = condition.trim()

    // Handle "not" prefix
    if (trimmed.startsWith('not ')) {
        return !evaluateMediaQuery(trimmed.substring(4), context)
    }

    // Handle "and" compound: split on " and " or ") and ("
    if (trimmed.includes(' and ')) {
        const parts = splitAnd(trimmed)
        return parts.every(part => evaluateSingle(part.trim(), context))
    }

    return evaluateSingle(trimmed, context)
}

function splitAnd(condition: string): string[] {
    // Split on ") and (" or " and "
    return condition.split(/\)\s*and\s*\(|\s+and\s+/).map(part => {
        // Strip outer parens
        let p = part.trim()
        if (p.startsWith('(')) p = p.substring(1)
        if (p.endsWith(')')) p = p.substring(0, p.length - 1)
        return p.trim()
    })
}

function evaluateSingle(condition: string, context: MediaContext): boolean {
    // Strip outer parens
    let c = condition.trim()
    if (c.startsWith('(')) c = c.substring(1)
    if (c.endsWith(')')) c = c.substring(0, c.length - 1)
    c = c.trim()

    const colonIdx = c.indexOf(':')
    if (colonIdx === -1) return false

    const feature = c.substring(0, colonIdx).trim()
    const value = c.substring(colonIdx + 1).trim()

    switch (feature) {
        case 'prefers-color-scheme':
            return value === context.colorScheme
        case 'display-mode':
            return value === context.displayMode
        case 'min-width':
            return context.width >= parseInt(value)
        case 'max-width':
            return context.width <= parseInt(value)
        case 'min-height':
            return context.height >= parseInt(value)
        case 'max-height':
            return context.height <= parseInt(value)
        default:
            return false
    }
}
