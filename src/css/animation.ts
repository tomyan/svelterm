import { expandLightDark } from './color.js'
import { resolveVar } from './variables.js'
import type { CSSStyleSheet, KeyframeStop } from './parser.js'

/**
 * Extract keyframe definitions from a parsed stylesheet.
 */
export function getKeyframes(sheet: CSSStyleSheet): Map<string, KeyframeStop[]> {
    return sheet.keyframes
}

/** Context for resolving var()/light-dark() inside keyframe declarations. */
export interface KeyframeResolution {
    /** Per-node custom properties, as collectVariables produces. */
    variables: Map<number, Map<string, string>>
    scheme: 'dark' | 'light'
}

/**
 * Resolve var() and light-dark() in keyframe values against the animated
 * element. Resolution happens once when the animation starts; later
 * custom-property changes don't retarget a running animation.
 */
export function resolveKeyframeStops(
    stops: KeyframeStop[], resolution: KeyframeResolution, nodeId: number,
): KeyframeStop[] {
    const vars = resolution.variables.get(nodeId) ?? new Map<string, string>()
    return stops.map(stop => ({
        offset: stop.offset,
        declarations: stop.declarations.map(decl => {
            let value = decl.value
            if (value.includes('var(')) value = resolveVar(value, vars)
            if (value.includes('light-dark(')) value = expandLightDark(value, resolution.scheme)
            return { property: decl.property, value }
        }),
    }))
}
