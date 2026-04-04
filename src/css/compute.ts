import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector } from './selector.js'
import { resolveColor } from './color.js'
import { parseCellValue, parseSizeValue, parseJustify, parseAlign, parsePadding } from './values.js'
import { collectVariables, resolveVar } from './variables.js'
import { computeSpecificity, compareSpecificity } from './specificity.js'
import { evaluateMediaQuery, type MediaContext } from './media.js'
import { computeLayout } from '../layout/engine.js'

const DEFAULT_MEDIA: MediaContext = {
    colorScheme: 'dark',
    displayMode: 'terminal',
    width: 80,
    height: 24,
}

export interface ResolvedStyle {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean

    display: 'block' | 'inline' | 'inline-block' | 'flex' | 'grid' | 'table' | 'table-row' | 'table-cell' | 'none'
    flexDirection: 'row' | 'column' | 'row-reverse' | 'column-reverse'
    justifyContent: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
    alignItems: 'start' | 'end' | 'center' | 'stretch'
    alignSelf: 'auto' | 'start' | 'end' | 'center' | 'stretch'
    gap: number
    paddingTop: number | string
    paddingRight: number | string
    paddingBottom: number | string
    paddingLeft: number | string
    width: number | string | null
    height: number | string | null
    minWidth: number | null
    minHeight: number | null
    maxWidth: number | null
    maxHeight: number | null
    marginTop: number | string
    marginRight: number | string
    marginBottom: number | string
    marginLeft: number | string
    flexGrow: number
    flexShrink: number
    flexWrap: 'nowrap' | 'wrap'
    order: number
    gridTemplateColumns: string | null
    gridTemplateRows: string | null
    animationName: string | null
    animationDuration: number
    animationIterationCount: number
    borderStyle: 'none' | 'single' | 'double' | 'rounded' | 'heavy'
    borderColor: string
    borderTop: boolean
    borderRight: boolean
    borderBottom: boolean
    borderLeft: boolean
    overflow: 'visible' | 'hidden' | 'scroll' | 'auto'
    textOverflow: 'clip' | 'ellipsis'
    whiteSpace: 'normal' | 'nowrap' | 'pre'
    textAlign: 'left' | 'center' | 'right'
    position: 'static' | 'relative' | 'absolute' | 'fixed'
    top: number | null
    right: number | null
    bottom: number | null
    left: number | null
    zIndex: number
    visibility: 'visible' | 'hidden'
}

const INLINE_ELEMENTS = new Set(['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'code', 'small', 'sub', 'sup'])
const TABLE_ELEMENTS: Record<string, ResolvedStyle['display']> = {
    table: 'table', tr: 'table-row', td: 'table-cell', th: 'table-cell',
}

function defaultDisplay(tag?: string): ResolvedStyle['display'] {
    if (!tag) return 'block'
    if (INLINE_ELEMENTS.has(tag)) return 'inline'
    if (tag in TABLE_ELEMENTS) return TABLE_ELEMENTS[tag]!
    return 'block'
}

export function defaultStyle(tag?: string): ResolvedStyle {
    return {
        fg: 'default', bg: 'default',
        bold: false, italic: false, underline: false, strikethrough: false, dim: false,
        display: defaultDisplay(tag),
        flexDirection: 'row',
        justifyContent: 'start', alignItems: 'start', alignSelf: 'auto',
        gap: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        width: null, height: null,
        minWidth: null, minHeight: null, maxWidth: null, maxHeight: null,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        flexGrow: 0, flexShrink: 1, flexWrap: 'nowrap', order: 0,
        gridTemplateColumns: null, gridTemplateRows: null,
        animationName: null, animationDuration: 0, animationIterationCount: 1,
        borderStyle: 'none', borderColor: 'default',
        borderTop: true, borderRight: true, borderBottom: true, borderLeft: true,
        overflow: 'visible',
        textOverflow: 'clip',
        whiteSpace: 'normal',
        textAlign: 'left',
        position: 'static',
        top: null, right: null, bottom: null, left: null,
        zIndex: 0,
        visibility: 'visible',
    }
}

export function resolveStyles(
    root: TermNode,
    stylesheet: CSSStyleSheet,
    media?: MediaContext,
    availWidth?: number,
    availHeight?: number,
): Map<number, ResolvedStyle> {
    const ctx = media ?? DEFAULT_MEDIA
    const hasContainerRules = stylesheet.rules.some(r => r.container)

    // Filter out non-matching @media and @supports, but keep @container for now
    const filtered = filterByMedia(stylesheet, ctx)

    if (!hasContainerRules) {
        // Simple path: no container queries
        const variables = collectVariables(root, filtered)
        const styles = new Map<number, ResolvedStyle>()
        resolveNode(root, filtered, styles, variables)
        return styles
    }

    // Two-pass for container queries:
    // Pass 1: resolve without @container rules to get initial layout
    const withoutContainer = filterContainerRules(filtered, false)
    const variables1 = collectVariables(root, withoutContainer)
    const styles1 = new Map<number, ResolvedStyle>()
    resolveNode(root, withoutContainer, styles1, variables1)

    // Compute layout to get container dimensions
    const layout = computeLayout(root, styles1, availWidth ?? ctx.width, availHeight ?? ctx.height)

    // Pass 2: evaluate container rules against computed layout
    const containerRules = filtered.rules.filter(r => r.container)
    const matchingContainerRules = containerRules.filter(r =>
        evaluateContainerQuery(r, root, layout)
    )

    if (matchingContainerRules.length === 0) return styles1

    // Re-resolve with matching container rules included
    const withMatchingContainers: CSSStyleSheet = {
        rules: [...withoutContainer.rules, ...matchingContainerRules],
        keyframes: filtered.keyframes,
    }
    const variables2 = collectVariables(root, withMatchingContainers)
    const styles2 = new Map<number, ResolvedStyle>()
    resolveNode(root, withMatchingContainers, styles2, variables2)
    return styles2
}

function filterByMedia(stylesheet: CSSStyleSheet, context: MediaContext): CSSStyleSheet {
    const rules = stylesheet.rules.filter(rule => {
        if (rule.media && !evaluateMediaQuery(rule.media, context)) return false
        if (rule.supports && !evaluateSupports(rule.supports)) return false
        return true
    })
    return { rules, keyframes: stylesheet.keyframes }
}

const SUPPORTED_PROPERTIES = new Set([
    'display', 'flex-direction', 'justify-content', 'align-items', 'align-self',
    'gap', 'flex-grow', 'flex-shrink', 'flex-wrap', 'flex', 'order',
    'grid-template-columns',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'color', 'background-color', 'background',
    'font-weight', 'font-style', 'text-decoration', 'text-align', 'text-overflow',
    'white-space', 'overflow', 'visibility', 'opacity',
    'border', 'border-style', 'border-color',
    'position', 'top', 'right', 'bottom', 'left', 'z-index',
])

function filterContainerRules(stylesheet: CSSStyleSheet, include: boolean): CSSStyleSheet {
    const rules = stylesheet.rules.filter(r => include ? !!r.container : !r.container)
    return { rules, keyframes: stylesheet.keyframes }
}

function evaluateContainerQuery(
    rule: import('./parser.js').CSSRule,
    root: TermNode,
    layout: Map<number, import('../layout/engine.js').LayoutBox>,
): boolean {
    if (!rule.container) return false
    const condition = rule.container
    const colonIdx = condition.indexOf(':')
    if (colonIdx === -1) return false

    const feature = condition.substring(0, colonIdx).trim()
    const value = parseInt(condition.substring(colonIdx + 1).trim())

    // Find nodes that match the rule's selectors, then check their container ancestors
    const matchingNodes = findMatchingNodes(root, rule.selectors)
    for (const node of matchingNodes) {
        if (hasMatchingContainerAncestor(node, feature, value, layout)) return true
    }
    return false
}

function findMatchingNodes(root: TermNode, selectors: string[]): TermNode[] {
    const result: TermNode[] = []
    walkNodes(root, (node) => {
        if (node.nodeType === 'element' && selectors.some(sel => matchesSelector(node, sel))) {
            result.push(node)
        }
    })
    return result
}

function walkNodes(node: TermNode, fn: (n: TermNode) => void): void {
    fn(node)
    for (const child of node.children) walkNodes(child, fn)
}

function hasMatchingContainerAncestor(
    node: TermNode, feature: string, value: number,
    layout: Map<number, import('../layout/engine.js').LayoutBox>,
): boolean {
    // Check nearest ancestor with a layout box (closest container)
    const ancestor = node.parent
    if (!ancestor) return false
    const box = layout.get(ancestor.id)
    if (!box) return false
    switch (feature) {
        case 'min-width': return box.width >= value
        case 'max-width': return box.width <= value
        case 'min-height': return box.height >= value
        case 'max-height': return box.height <= value
    }
    return false
}

function evaluateSupports(condition: string): boolean {
    const colonIdx = condition.indexOf(':')
    if (colonIdx === -1) return false
    const property = condition.substring(0, colonIdx).trim()
    return SUPPORTED_PROPERTIES.has(property)
}

function resolveNode(
    node: TermNode, stylesheet: CSSStyleSheet,
    styles: Map<number, ResolvedStyle>,
    variables: Map<number, Map<string, string>>,
): void {
    if (node.nodeType === 'element') {
        const vars = variables.get(node.id) ?? new Map()
        const parentStyle = node.parent ? styles.get(node.parent.id) : undefined
        const resolved = computeStyle(node, stylesheet, vars, parentStyle)
        styles.set(node.id, resolved)
        node.cache.resolvedStyle = resolved
        node.cache.classAttr = node.attributes.get('class') ?? ''
    }
    for (const child of node.children) {
        resolveNode(child, stylesheet, styles, variables)
    }
}

/**
 * Resolve style for a single node, given the stylesheet and parent style.
 * Used by incremental style resolution.
 */
export function resolveNodeStyle(
    node: TermNode,
    stylesheet: CSSStyleSheet,
    parentStyle?: ResolvedStyle,
): ResolvedStyle {
    // Collect variables from the tree root down to this node,
    // so inherited CSS variables (e.g. from :root) are available.
    const treeRoot = findRoot(node)
    const variables = collectVariables(treeRoot, stylesheet)
    const vars = variables.get(node.id) ?? new Map()
    return computeStyle(node, stylesheet, vars, parentStyle)
}

function findRoot(node: TermNode): TermNode {
    let current = node
    while (current.parent) current = current.parent
    return current
}

interface ScoredDeclaration {
    property: string
    value: string
    specificity: [number, number, number]
    order: number
}

function computeStyle(node: TermNode, stylesheet: CSSStyleSheet, vars: Map<string, string>, parentStyle?: ResolvedStyle): ResolvedStyle {
    const style = defaultStyle(node.tag)

    // Collect all matching declarations with specificity
    const scored: ScoredDeclaration[] = []
    let order = 0

    for (const rule of stylesheet.rules) {
        for (const selector of rule.selectors) {
            if (!matchesSelector(node, selector)) continue
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

    // Sort by specificity (ascending), then by source order (ascending)
    // Later application = higher priority, so lower specificity first
    scored.sort((a, b) => {
        const specCmp = compareSpecificity(a.specificity, b.specificity)
        return specCmp !== 0 ? specCmp : a.order - b.order
    })

    for (const decl of scored) {
        if (decl.value === 'inherit' && parentStyle) {
            applyInherit(style, decl.property, parentStyle)
        } else if (decl.value === 'initial') {
            applyInitial(style, decl.property, node.tag)
        } else if (decl.value === 'unset') {
            if (INHERITABLE_PROPERTIES.has(decl.property) && parentStyle) {
                applyInherit(style, decl.property, parentStyle)
            } else {
                applyInitial(style, decl.property, node.tag)
            }
        } else {
            applyDeclaration(style, decl.property, decl.value)
        }
    }

    return style
}

const INHERITABLE_PROPERTIES = new Set([
    'color', 'font-weight', 'font-style', 'text-decoration',
    'white-space', 'text-align', 'visibility', 'opacity',
])

function applyInherit(style: ResolvedStyle, property: string, parentStyle: ResolvedStyle): void {
    switch (property) {
        case 'color': style.fg = parentStyle.fg; break
        case 'background-color': case 'background': style.bg = parentStyle.bg; break
        case 'font-weight': style.bold = parentStyle.bold; break
        case 'font-style': style.italic = parentStyle.italic; break
        case 'text-decoration': style.underline = parentStyle.underline; style.strikethrough = parentStyle.strikethrough; break
        case 'white-space': style.whiteSpace = parentStyle.whiteSpace; break
        case 'text-align': style.textAlign = parentStyle.textAlign; break
        case 'visibility': style.visibility = parentStyle.visibility; break
        case 'opacity': style.dim = parentStyle.dim; break
    }
}

function applyInitial(style: ResolvedStyle, property: string, tag?: string): void {
    const initial = defaultStyle(tag)
    switch (property) {
        case 'color': style.fg = initial.fg; break
        case 'background-color': case 'background': style.bg = initial.bg; break
        case 'font-weight': style.bold = initial.bold; break
        case 'font-style': style.italic = initial.italic; break
        case 'text-decoration': style.underline = initial.underline; style.strikethrough = initial.strikethrough; break
    }
}

function applyDeclaration(style: ResolvedStyle, property: string, value: string): void {
    switch (property) {
        case 'color': style.fg = resolveColor(value); break
        case 'background-color':
        case 'background': style.bg = resolveColor(value); break
        case 'font-weight': style.bold = value === 'bold' || parseInt(value) >= 700; break
        case 'font-style': style.italic = value === 'italic'; break
        case 'text-decoration':
            if (value.includes('underline')) style.underline = true
            if (value.includes('line-through')) style.strikethrough = true
            break
        case 'display':
            if (['block', 'inline', 'inline-block', 'flex', 'grid', 'table', 'table-row', 'table-cell', 'none'].includes(value)) {
                style.display = value as ResolvedStyle['display']
            }
            break
        case 'flex-direction':
            if (['row', 'column', 'row-reverse', 'column-reverse'].includes(value)) {
                style.flexDirection = value as ResolvedStyle['flexDirection']
            }
            break
        case 'justify-content': style.justifyContent = parseJustify(value); break
        case 'align-items': style.alignItems = parseAlign(value); break
        case 'align-self':
            if (['auto', 'start', 'end', 'center', 'stretch', 'flex-start', 'flex-end'].includes(value)) {
                style.alignSelf = value === 'flex-start' ? 'start' : value === 'flex-end' ? 'end' : value as ResolvedStyle['alignSelf']
            }
            break
        case 'gap': style.gap = parseCellValue(value); break
        case 'padding': {
            const parts = value.split(/\s+/)
            const parsed = parts.map(parseSizeOrCell)
            if (parsed.length === 1) {
                style.paddingTop = style.paddingRight = style.paddingBottom = style.paddingLeft = parsed[0]
            } else if (parsed.length === 2) {
                style.paddingTop = style.paddingBottom = parsed[0]
                style.paddingRight = style.paddingLeft = parsed[1]
            } else if (parsed.length === 3) {
                style.paddingTop = parsed[0]
                style.paddingRight = style.paddingLeft = parsed[1]
                style.paddingBottom = parsed[2]
            } else if (parsed.length >= 4) {
                style.paddingTop = parsed[0]; style.paddingRight = parsed[1]
                style.paddingBottom = parsed[2]; style.paddingLeft = parsed[3]
            }
            break
        }
        case 'padding-top': style.paddingTop = parseSizeOrCell(value); break
        case 'padding-right': style.paddingRight = parseSizeOrCell(value); break
        case 'padding-bottom': style.paddingBottom = parseSizeOrCell(value); break
        case 'padding-left': style.paddingLeft = parseSizeOrCell(value); break
        case 'width': style.width = parseSizeValue(value); break
        case 'height': style.height = parseSizeValue(value); break
        case 'min-width': style.minWidth = parseCellValue(value); break
        case 'min-height': style.minHeight = parseCellValue(value); break
        case 'max-width': style.maxWidth = parseCellValue(value); break
        case 'max-height': style.maxHeight = parseCellValue(value); break
        case 'margin': {
            const parts = value.split(/\s+/)
            const parsed = parts.map(p => p === 'auto' ? -1 as number | string : parseSizeOrCell(p))
            if (parsed.length === 1) {
                style.marginTop = style.marginRight = style.marginBottom = style.marginLeft = parsed[0]
            } else if (parsed.length === 2) {
                style.marginTop = style.marginBottom = parsed[0]
                style.marginRight = style.marginLeft = parsed[1]
            } else if (parsed.length === 3) {
                style.marginTop = parsed[0]
                style.marginRight = style.marginLeft = parsed[1]
                style.marginBottom = parsed[2]
            } else if (parsed.length >= 4) {
                style.marginTop = parsed[0]; style.marginRight = parsed[1]
                style.marginBottom = parsed[2]; style.marginLeft = parsed[3]
            }
            break
        }
        case 'margin-top': style.marginTop = value === 'auto' ? -1 : parseSizeOrCell(value); break
        case 'margin-right': style.marginRight = value === 'auto' ? -1 : parseSizeOrCell(value); break
        case 'margin-bottom': style.marginBottom = value === 'auto' ? -1 : parseSizeOrCell(value); break
        case 'margin-left': style.marginLeft = value === 'auto' ? -1 : parseSizeOrCell(value); break
        case 'flex':
            // flex shorthand: flex: <grow> [<shrink> [<basis>]]
            const flexParts = value.split(/\s+/)
            style.flexGrow = parseFloat(flexParts[0]) || 0
            if (flexParts.length > 1) style.flexShrink = parseFloat(flexParts[1]) || 1
            break
        case 'flex-grow': style.flexGrow = parseFloat(value) || 0; break
        case 'flex-shrink': style.flexShrink = parseFloat(value) || 1; break
        case 'flex-wrap': style.flexWrap = value === 'wrap' ? 'wrap' : 'nowrap'; break
        case 'order': style.order = parseInt(value) || 0; break
        case 'grid-template-columns': style.gridTemplateColumns = value; break
        case 'grid-template-rows': style.gridTemplateRows = value; break
        case 'animation': parseAnimationShorthand(style, value); break
        case 'animation-name': style.animationName = value === 'none' ? null : value; break
        case 'animation-duration': style.animationDuration = parseDuration(value); break
        case 'animation-iteration-count':
            style.animationIterationCount = value === 'infinite' ? Infinity : (parseInt(value) || 1)
            break
        case 'border':
            if (BORDER_STYLES.has(value)) style.borderStyle = value as ResolvedStyle['borderStyle']
            break
        case 'border-style':
            if (BORDER_STYLES.has(value)) style.borderStyle = value as ResolvedStyle['borderStyle']
            break
        case 'border-color':
            style.borderColor = value === 'currentColor' ? style.fg : resolveColor(value)
            break
        case 'border-top': setIndividualBorderSide(style, 'borderTop', value); break
        case 'border-right': setIndividualBorderSide(style, 'borderRight', value); break
        case 'border-bottom': setIndividualBorderSide(style, 'borderBottom', value); break
        case 'border-left': setIndividualBorderSide(style, 'borderLeft', value); break
        case 'overflow':
            if (value === 'hidden' || value === 'scroll' || value === 'auto') style.overflow = value
            else style.overflow = 'visible'
            break
        case 'text-overflow':
            style.textOverflow = value === 'ellipsis' ? 'ellipsis' : 'clip'
            break
        case 'white-space':
            if (value === 'nowrap' || value === 'pre') style.whiteSpace = value
            else style.whiteSpace = 'normal'
            break
        case 'text-align':
            if (value === 'center' || value === 'right') style.textAlign = value
            else style.textAlign = 'left'
            break
        case 'position':
            if (value === 'relative' || value === 'absolute' || value === 'fixed') style.position = value
            else style.position = 'static'
            break
        case 'top': style.top = parseCellValue(value); break
        case 'right': style.right = parseCellValue(value); break
        case 'bottom': style.bottom = parseCellValue(value); break
        case 'left': style.left = parseCellValue(value); break
        case 'z-index': style.zIndex = parseInt(value) || 0; break
        case 'visibility': style.visibility = value === 'hidden' ? 'hidden' : 'visible'; break
        case 'opacity':
            if (value === 'dim') { style.dim = true }
            else {
                const num = parseFloat(value)
                style.dim = !isNaN(num) && num < 1
            }
            break
    }
}

const BORDER_STYLES = new Set(['none', 'single', 'double', 'rounded', 'heavy'])

function setIndividualBorderSide(style: ResolvedStyle, side: 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft', value: string): void {
    const enabled = value === 'true' || value === '1'
    // When setting individual sides, disable all others first (if this is the first individual side set)
    if (enabled && style.borderTop && style.borderRight && style.borderBottom && style.borderLeft) {
        style.borderTop = false
        style.borderRight = false
        style.borderBottom = false
        style.borderLeft = false
    }
    style[side] = enabled
}

function parseSizeOrCell(value: string): number | string {
    if (value.endsWith('%')) return value
    if (value.startsWith('calc(') || value.startsWith('min(') || value.startsWith('max(') || value.startsWith('clamp(')) return value
    return parseCellValue(value)
}

function parseAnimationShorthand(style: ResolvedStyle, value: string): void {
    if (value === 'none') {
        style.animationName = null
        return
    }
    const parts = value.split(/\s+/)
    for (const part of parts) {
        if (part.endsWith('s') && !part.endsWith('ss')) {
            style.animationDuration = parseDuration(part)
        } else if (part === 'infinite') {
            style.animationIterationCount = Infinity
        } else if (/^\d+$/.test(part)) {
            style.animationIterationCount = parseInt(part)
        } else if (!['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'normal', 'reverse', 'alternate', 'forwards', 'backwards', 'both', 'running', 'paused'].includes(part)) {
            style.animationName = part
        }
    }
}

function parseDuration(value: string): number {
    if (value.endsWith('ms')) return parseFloat(value)
    if (value.endsWith('s')) return parseFloat(value) * 1000
    return 0
}
