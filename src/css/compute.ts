import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector } from './selector.js'
import { resolveColor } from './color.js'
import { parseCellValue, parseSizeValue, parseJustify, parseAlign, parsePadding } from './values.js'

export interface ResolvedStyle {
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean

    display: 'flex' | 'none'
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
}

const INLINE_ELEMENTS = new Set(['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'code', 'small'])

export function defaultStyle(tag?: string): ResolvedStyle {
    return {
        fg: 'default', bg: 'default',
        bold: false, italic: false, underline: false, strikethrough: false, dim: false,
        display: 'flex',
        flexDirection: INLINE_ELEMENTS.has(tag ?? '') ? 'row' : 'column',
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
    }
}

export function resolveStyles(root: TermNode, stylesheet: CSSStyleSheet): Map<number, ResolvedStyle> {
    const styles = new Map<number, ResolvedStyle>()
    resolveNode(root, stylesheet, styles)
    return styles
}

function resolveNode(node: TermNode, stylesheet: CSSStyleSheet, styles: Map<number, ResolvedStyle>): void {
    if (node.nodeType === 'element') {
        styles.set(node.id, computeStyle(node, stylesheet))
    }
    for (const child of node.children) {
        resolveNode(child, stylesheet, styles)
    }
}

function computeStyle(node: TermNode, stylesheet: CSSStyleSheet): ResolvedStyle {
    const style = defaultStyle(node.tag)

    for (const rule of stylesheet.rules) {
        if (!rule.selectors.some(sel => matchesSelector(node, sel))) continue
        for (const decl of rule.declarations) {
            applyDeclaration(style, decl.property, decl.value)
        }
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
        case 'display': style.display = value === 'none' ? 'none' : 'flex'; break
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
