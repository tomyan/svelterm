import { TermNode } from '../renderer/node.js'
import { CSSStyleSheet } from './parser.js'
import { matchesSelector } from './selector.js'

export interface ResolvedStyle {
    // Visual
    fg: string
    bg: string
    bold: boolean
    italic: boolean
    underline: boolean
    strikethrough: boolean
    dim: boolean

    // Layout
    display: 'flex' | 'none'
    flexDirection: 'row' | 'column'
    justifyContent: 'start' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly'
    alignItems: 'start' | 'end' | 'center' | 'stretch'
    gap: number
    paddingTop: number
    paddingRight: number
    paddingBottom: number
    paddingLeft: number
    width: number | string | null    // number = cells, string = percentage, null = auto
    height: number | string | null
    minWidth: number | null
    minHeight: number | null
    maxWidth: number | null
    maxHeight: number | null
    flexGrow: number
    flexShrink: number
}

const DEFAULT_STYLE: ResolvedStyle = {
    fg: 'default', bg: 'default',
    bold: false, italic: false, underline: false, strikethrough: false, dim: false,
    display: 'flex', flexDirection: 'column',
    justifyContent: 'start', alignItems: 'start',
    gap: 0,
    paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
    width: null, height: null,
    minWidth: null, minHeight: null, maxWidth: null, maxHeight: null,
    flexGrow: 0, flexShrink: 1,
}

export function resolveStyles(root: TermNode, stylesheet: CSSStyleSheet): Map<number, ResolvedStyle> {
    const styles = new Map<number, ResolvedStyle>()
    resolveNode(root, stylesheet, styles)
    return styles
}

function resolveNode(node: TermNode, stylesheet: CSSStyleSheet, styles: Map<number, ResolvedStyle>): void {
    if (node.nodeType === 'element') {
        const style = computeStyle(node, stylesheet)
        styles.set(node.id, style)
    }

    for (const child of node.children) {
        resolveNode(child, stylesheet, styles)
    }
}

function computeStyle(node: TermNode, stylesheet: CSSStyleSheet): ResolvedStyle {
    const style: ResolvedStyle = { ...DEFAULT_STYLE }

    // Inline elements default to row direction
    if (INLINE_ELEMENTS.has(node.tag ?? '')) {
        style.flexDirection = 'row'
    }

    for (const rule of stylesheet.rules) {
        const matches = rule.selectors.some(sel => matchesSelector(node, sel))
        if (!matches) continue

        for (const decl of rule.declarations) {
            applyDeclaration(style, decl.property, decl.value)
        }
    }

    return style
}

function applyDeclaration(style: ResolvedStyle, property: string, value: string): void {
    switch (property) {
        case 'color':
            style.fg = resolveColor(value)
            break
        case 'background-color':
        case 'background':
            style.bg = resolveColor(value)
            break
        case 'font-weight':
            style.bold = value === 'bold' || parseInt(value) >= 700
            break
        case 'font-style':
            style.italic = value === 'italic'
            break
        case 'text-decoration':
            if (value.includes('underline')) style.underline = true
            if (value.includes('line-through')) style.strikethrough = true
            break
        case 'display':
            if (value === 'none') style.display = 'none'
            else style.display = 'flex'
            break
        case 'flex-direction':
            if (value === 'row' || value === 'column') style.flexDirection = value
            break
        case 'justify-content':
            style.justifyContent = parseJustify(value)
            break
        case 'align-items':
            style.alignItems = parseAlign(value)
            break
        case 'gap':
            style.gap = parseCellValue(value)
            break
        case 'padding':
            parsePaddingShorthand(style, value)
            break
        case 'padding-top':
            style.paddingTop = parseCellValue(value)
            break
        case 'padding-right':
            style.paddingRight = parseCellValue(value)
            break
        case 'padding-bottom':
            style.paddingBottom = parseCellValue(value)
            break
        case 'padding-left':
            style.paddingLeft = parseCellValue(value)
            break
        case 'width':
            style.width = parseSizeValue(value)
            break
        case 'height':
            style.height = parseSizeValue(value)
            break
        case 'min-width':
            style.minWidth = parseCellValue(value)
            break
        case 'min-height':
            style.minHeight = parseCellValue(value)
            break
        case 'max-width':
            style.maxWidth = parseCellValue(value)
            break
        case 'max-height':
            style.maxHeight = parseCellValue(value)
            break
        case 'flex-grow':
            style.flexGrow = parseFloat(value) || 0
            break
        case 'flex-shrink':
            style.flexShrink = parseFloat(value) || 1
            break
    }
}

function parsePaddingShorthand(style: ResolvedStyle, value: string): void {
    const parts = value.split(/\s+/).map(parseCellValue)
    if (parts.length === 1) {
        style.paddingTop = style.paddingRight = style.paddingBottom = style.paddingLeft = parts[0]
    } else if (parts.length === 2) {
        style.paddingTop = style.paddingBottom = parts[0]
        style.paddingRight = style.paddingLeft = parts[1]
    } else if (parts.length === 3) {
        style.paddingTop = parts[0]
        style.paddingRight = style.paddingLeft = parts[1]
        style.paddingBottom = parts[2]
    } else if (parts.length === 4) {
        style.paddingTop = parts[0]
        style.paddingRight = parts[1]
        style.paddingBottom = parts[2]
        style.paddingLeft = parts[3]
    }
}

function parseCellValue(value: string): number {
    // Strip units — in terminal context, all values are cell counts
    // Svelte's compiler adds 'px' to bare numbers, so strip that too
    const stripped = value.replace(/px$/, '')
    const num = parseFloat(stripped)
    return isNaN(num) ? 0 : Math.round(num)
}

function parseSizeValue(value: string): number | string | null {
    if (value === 'auto') return null
    if (value.endsWith('%')) return value
    const stripped = value.replace(/px$/, '')
    return parseCellValue(stripped)
}

function parseJustify(value: string): ResolvedStyle['justifyContent'] {
    const map: Record<string, ResolvedStyle['justifyContent']> = {
        'flex-start': 'start', 'start': 'start',
        'flex-end': 'end', 'end': 'end',
        'center': 'center',
        'space-between': 'space-between',
        'space-around': 'space-around',
        'space-evenly': 'space-evenly',
    }
    return map[value] ?? 'start'
}

function parseAlign(value: string): ResolvedStyle['alignItems'] {
    const map: Record<string, ResolvedStyle['alignItems']> = {
        'flex-start': 'start', 'start': 'start',
        'flex-end': 'end', 'end': 'end',
        'center': 'center', 'stretch': 'stretch',
    }
    return map[value] ?? 'start'
}

function resolveColor(value: string): string {
    const ansiName = ANSI_COLOR_NAMES[value.toLowerCase()]
    if (ansiName) return ansiName

    if (value.startsWith('#')) {
        const expanded = expandHex(value)
        return hexToNearestAnsi(expanded) ?? expanded
    }

    return 'default'
}

function expandHex(hex: string): string {
    const h = hex.slice(1)
    if (h.length === 3) return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    return hex
}

function hexToNearestAnsi(hex: string): string | null {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    for (const [name, [cr, cg, cb]] of Object.entries(ANSI_RGB)) {
        if (r === cr && g === cg && b === cb) return name
    }
    return null
}

const ANSI_COLOR_NAMES: Record<string, string> = {
    black: 'black', red: 'red', green: 'green', yellow: 'yellow',
    blue: 'blue', magenta: 'magenta', cyan: 'cyan', white: 'white',
}

const ANSI_RGB: Record<string, [number, number, number]> = {
    black: [0, 0, 0], red: [255, 0, 0], green: [0, 255, 0], yellow: [255, 255, 0],
    blue: [0, 0, 255], magenta: [255, 0, 255], cyan: [0, 255, 255], white: [255, 255, 255],
}

const INLINE_ELEMENTS = new Set(['span', 'a', 'strong', 'em', 'b', 'i', 'u', 'code', 'small'])
