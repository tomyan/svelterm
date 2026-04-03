import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector } from './selector.js'

/** Collect custom properties for each element, with inheritance from ancestors. */
export function collectVariables(
    root: TermNode,
    stylesheet: CSSStyleSheet,
): Map<number, Map<string, string>> {
    const result = new Map<number, Map<string, string>>()
    collectNode(root, stylesheet, result, new Map())
    return result
}

function collectNode(
    node: TermNode,
    stylesheet: CSSStyleSheet,
    result: Map<number, Map<string, string>>,
    inherited: Map<string, string>,
): void {
    if (node.nodeType !== 'element') return

    // Start with inherited variables
    const vars = new Map(inherited)

    // Add variables from matching rules
    for (const rule of stylesheet.rules) {
        if (!rule.selectors.some(sel => matchesSelector(node, sel))) continue
        for (const decl of rule.declarations) {
            if (decl.property.startsWith('--')) {
                vars.set(decl.property, decl.value)
            }
        }
    }

    result.set(node.id, vars)

    for (const child of node.children) {
        collectNode(child, stylesheet, result, vars)
    }
}

const VAR_RE = /var\(\s*(--[a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/

/** Resolve var() references in a CSS value. */
export function resolveVar(value: string, vars: Map<string, string>): string {
    let resolved = value
    let match: RegExpExecArray | null

    // Resolve iteratively (handles nested vars if needed)
    let limit = 10
    while ((match = VAR_RE.exec(resolved)) && limit-- > 0) {
        const varName = match[1]
        const fallback = match[2]?.trim()
        const replacement = vars.get(varName) ?? fallback ?? ''
        resolved = resolved.substring(0, match.index) + replacement + resolved.substring(match.index + match[0].length)
    }

    return resolved
}
