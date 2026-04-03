import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector } from './selector.js'
import { resolveColor } from './color.js'
import { parseCellValue, parseSizeValue, parseJustify, parseAlign, parsePadding } from './values.js'
import { collectVariables, resolveVar } from './variables.js'
import { computeSpecificity, compareSpecificity } from './specificity.js'
import { evaluateMediaQuery, type MediaContext } from './media.js'

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

    display: 'block' | 'inline' | 'inline-block' | 'flex' | 'table' | 'table-row' | 'table-cell' | 'none'
    flexDirection: 'row' | 'column'
    justifyContent: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
    alignItems: 'start' | 'end' | 'center' | 'stretch'
    gap: number
    paddingTop: number
    paddingRight: number
    paddingBottom: number
    paddingLeft: number
    width: number | string | null
    height: number | string | null
    minWidth: number | null
    minHeight: number | null
    maxWidth: number | null
    maxHeight: number | null
    marginTop: number
    marginRight: number
    marginBottom: number
    marginLeft: number
    flexGrow: number
    flexShrink: number
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
        flexDirection: 'column',
        justifyContent: 'start', alignItems: 'start',
        gap: 0,
        paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
        width: null, height: null,
        minWidth: null, minHeight: null, maxWidth: null, maxHeight: null,
        marginTop: 0, marginRight: 0, marginBottom: 0, marginLeft: 0,
        flexGrow: 0, flexShrink: 1,
        borderStyle: 'none', borderColor: 'default',
        borderTop: true, borderRight: true, borderBottom: true, borderLeft: true,
        overflow: 'visible',
        textOverflow: 'clip',
        whiteSpace: 'normal',
        textAlign: 'left',
        position: 'static',
        top: null, right: null, bottom: null, left: null,
        zIndex: 0,
    }
}

export function resolveStyles(
    root: TermNode,
    stylesheet: CSSStyleSheet,
    media?: MediaContext,
): Map<number, ResolvedStyle> {
    const ctx = media ?? DEFAULT_MEDIA
    const filtered = filterByMedia(stylesheet, ctx)
    const variables = collectVariables(root, filtered)
    const styles = new Map<number, ResolvedStyle>()
    resolveNode(root, filtered, styles, variables)
    return styles
}

function filterByMedia(stylesheet: CSSStyleSheet, context: MediaContext): CSSStyleSheet {
    const rules = stylesheet.rules.filter(rule => {
        if (!rule.media) return true
        return evaluateMediaQuery(rule.media, context)
    })
    return { rules }
}

function resolveNode(
    node: TermNode, stylesheet: CSSStyleSheet,
    styles: Map<number, ResolvedStyle>,
    variables: Map<number, Map<string, string>>,
): void {
    if (node.nodeType === 'element') {
        const vars = variables.get(node.id) ?? new Map()
        styles.set(node.id, computeStyle(node, stylesheet, vars))
    }
    for (const child of node.children) {
        resolveNode(child, stylesheet, styles, variables)
    }
}

interface ScoredDeclaration {
    property: string
    value: string
    specificity: [number, number, number]
    order: number
}

function computeStyle(node: TermNode, stylesheet: CSSStyleSheet, vars: Map<string, string>): ResolvedStyle {
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
        applyDeclaration(style, decl.property, decl.value)
    }

    return style
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
            if (['block', 'inline', 'inline-block', 'flex', 'table', 'table-row', 'table-cell', 'none'].includes(value)) {
                style.display = value as ResolvedStyle['display']
            }
            break
        case 'flex-direction':
            if (value === 'row' || value === 'column') style.flexDirection = value
            break
        case 'justify-content': style.justifyContent = parseJustify(value); break
        case 'align-items': style.alignItems = parseAlign(value); break
        case 'gap': style.gap = parseCellValue(value); break
        case 'padding': {
            const p = parsePadding(value)
            style.paddingTop = p.top; style.paddingRight = p.right
            style.paddingBottom = p.bottom; style.paddingLeft = p.left
            break
        }
        case 'padding-top': style.paddingTop = parseCellValue(value); break
        case 'padding-right': style.paddingRight = parseCellValue(value); break
        case 'padding-bottom': style.paddingBottom = parseCellValue(value); break
        case 'padding-left': style.paddingLeft = parseCellValue(value); break
        case 'width': style.width = parseSizeValue(value); break
        case 'height': style.height = parseSizeValue(value); break
        case 'min-width': style.minWidth = parseCellValue(value); break
        case 'min-height': style.minHeight = parseCellValue(value); break
        case 'max-width': style.maxWidth = parseCellValue(value); break
        case 'max-height': style.maxHeight = parseCellValue(value); break
        case 'margin': {
            const m = parsePadding(value) // same shorthand logic
            style.marginTop = m.top; style.marginRight = m.right
            style.marginBottom = m.bottom; style.marginLeft = m.left
            break
        }
        case 'margin-top': style.marginTop = parseCellValue(value); break
        case 'margin-right': style.marginRight = parseCellValue(value); break
        case 'margin-bottom': style.marginBottom = parseCellValue(value); break
        case 'margin-left': style.marginLeft = parseCellValue(value); break
        case 'flex-grow': style.flexGrow = parseFloat(value) || 0; break
        case 'flex-shrink': style.flexShrink = parseFloat(value) || 1; break
        case 'border':
            if (BORDER_STYLES.has(value)) style.borderStyle = value as ResolvedStyle['borderStyle']
            break
        case 'border-style':
            if (BORDER_STYLES.has(value)) style.borderStyle = value as ResolvedStyle['borderStyle']
            break
        case 'border-color': style.borderColor = resolveColor(value); break
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
        case 'opacity': style.dim = value === 'dim'; break
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
