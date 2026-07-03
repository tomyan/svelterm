import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector, splitPseudoElement, type PseudoElement } from './selector.js'
import { computeSpecificity, compareSpecificity } from './specificity.js'
import { resolveVar } from './variables.js'
import { defaultStyle, applyDeclaration, type ResolvedStyle } from './compute.js'

/**
 * Resolve ::before/::after for one element: build the pseudo's style from
 * matching rules, materialise (or drop) its synthetic box on the node, and
 * record the style under the synthetic node's id.
 */
export function resolvePseudoElements(
    node: TermNode, stylesheet: CSSStyleSheet,
    styles: Map<number, ResolvedStyle>,
    vars: Map<string, string>,
    scheme: 'dark' | 'light',
): void {
    node.pseudoBefore = syncPseudo(node, node.pseudoBefore, 'before', stylesheet, styles, vars, scheme)
    node.pseudoAfter = syncPseudo(node, node.pseudoAfter, 'after', stylesheet, styles, vars, scheme)
}

interface ScoredDeclaration {
    property: string
    value: string
    specificity: [number, number, number]
    order: number
}

function syncPseudo(
    host: TermNode, existing: TermNode | null, which: PseudoElement,
    stylesheet: CSSStyleSheet, styles: Map<number, ResolvedStyle>,
    vars: Map<string, string>, scheme: 'dark' | 'light',
): TermNode | null {
    const declarations = collectPseudoDeclarations(host, which, stylesheet, vars)
    const content = resolveContent(declarations, host)
    if (content === null) {
        if (existing) styles.delete(existing.id)
        return null
    }

    // Pseudo boxes behave like spans: inline, inheriting visuals at paint time
    const style = defaultStyle('span')
    for (const decl of declarations) {
        if (decl.property === 'content') continue
        applyDeclaration(style, decl.property, decl.value, scheme)
    }

    const pseudoNode = existing ?? createPseudoNode(host)
    pseudoNode.children[0].text = content
    styles.set(pseudoNode.id, style)
    return pseudoNode
}

function collectPseudoDeclarations(
    host: TermNode, which: PseudoElement,
    stylesheet: CSSStyleSheet, vars: Map<string, string>,
): ScoredDeclaration[] {
    const scored: ScoredDeclaration[] = []
    let order = 0
    for (const rule of stylesheet.rules) {
        for (const selector of rule.selectors) {
            const { base, pseudoElement } = splitPseudoElement(selector)
            if (pseudoElement !== which) continue
            if (base !== '' && !matchesSelector(host, base)) continue
            const specificity = computeSpecificity(selector)
            for (const decl of rule.declarations) {
                if (decl.property.startsWith('--')) continue
                scored.push({
                    property: decl.property,
                    value: resolveVar(decl.value, vars),
                    specificity,
                    order: order++,
                })
            }
        }
    }
    scored.sort((a, b) => {
        const specCmp = compareSpecificity(a.specificity, b.specificity)
        return specCmp !== 0 ? specCmp : a.order - b.order
    })
    return scored
}

/**
 * The winning `content` value rendered to text, or null when the pseudo
 * generates no box (no content declaration, `none`/`normal`, or empty).
 */
function resolveContent(declarations: ScoredDeclaration[], host: TermNode): string | null {
    const winner = declarations.filter(d => d.property === 'content').pop()
    if (!winner) return null
    const text = parseContentValue(winner.value, host)
    return text === '' ? null : text
}

const CONTENT_TOKEN = /"([^"]*)"|'([^']*)'|attr\(\s*([^)\s]+)\s*\)/g

/** content: a space-separated sequence of quoted strings and attr() lookups. */
function parseContentValue(value: string, host: TermNode): string {
    const trimmed = value.trim()
    if (trimmed === 'none' || trimmed === 'normal') return ''
    let text = ''
    for (const match of trimmed.matchAll(CONTENT_TOKEN)) {
        if (match[3] !== undefined) text += host.attributes.get(match[3]) ?? ''
        else text += match[1] ?? match[2] ?? ''
    }
    return text
}

function createPseudoNode(host: TermNode): TermNode {
    const pseudoNode = new TermNode('element', 'svt-pseudo')
    pseudoNode.parent = host
    const textNode = new TermNode('text', '')
    textNode.parent = pseudoNode
    pseudoNode.children.push(textNode)
    return pseudoNode
}
