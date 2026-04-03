import type { CSSStyleSheet, KeyframeStop } from './parser.js'

/**
 * Extract keyframe definitions from a parsed stylesheet.
 */
export function getKeyframes(sheet: CSSStyleSheet): Map<string, KeyframeStop[]> {
    return sheet.keyframes
}
