export interface MediaContext {
    colorScheme: 'dark' | 'light'
    displayMode: 'terminal' | 'screen'
    width: number
    height: number
}

/**
 * Evaluate a media query condition against the current context.
 * Condition is the content inside @media(...), e.g. "prefers-color-scheme: dark"
 */
export function evaluateMediaQuery(condition: string, context: MediaContext): boolean {
    const trimmed = condition.trim()

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) return false

    const feature = trimmed.substring(0, colonIdx).trim()
    const value = trimmed.substring(colonIdx + 1).trim()

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
