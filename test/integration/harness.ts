/**
 * Integration test harness — builds a TermNode tree, runs the full
 * CSS → style resolution → layout → paint pipeline, returns the buffer.
 */
import { TermNode } from '../../src/renderer/node.js'
import { CellBuffer } from '../../src/render/buffer.js'
import { parseCSS } from '../../src/css/parser.js'
import { resolveStyles } from '../../src/css/compute.js'
import { computeLayout } from '../../src/layout/engine.js'
import { paint } from '../../src/render/paint.js'
import { syncLayoutCache } from '../../src/layout/cache.js'

export interface RenderOptions {
    width?: number
    height?: number
    css: string
}

export interface RenderResult {
    root: TermNode
    buffer: CellBuffer
    styles: Map<number, import('../../src/css/compute.js').ResolvedStyle>
    layout: Map<number, import('../../src/layout/engine.js').LayoutBox>
}

/**
 * Build a tree using a simple DSL, apply CSS, render to buffer.
 *
 * Usage:
 *   const tree = el('div', { class: 'app' }, [
 *       el('span', { class: 'title' }, [text('Hello')]),
 *       el('button', {}, [text('Click me')]),
 *   ])
 *   const { buffer } = render(tree, { css: '.app { display: flex; }' })
 */
export function render(tree: TermNode, options: RenderOptions): RenderResult {
    const width = options.width ?? 40
    const height = options.height ?? 10

    const root = new TermNode('element', 'root')
    root.insertBefore(tree, null)

    const stylesheet = parseCSS(options.css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    syncLayoutCache(root, layout)

    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)

    return { root, buffer, styles, layout }
}

/** Create an element node with optional attributes and children. */
export function el(tag: string, attrs?: Record<string, string>, children?: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            node.attributes.set(key, value)
        }
    }
    if (children) {
        for (const child of children) {
            node.insertBefore(child, null)
        }
    }
    return node
}

/** Create a text node. */
export function text(content: string): TermNode {
    return new TermNode('text', content)
}

/** Extract a row of characters from the buffer as a string (trimmed). */
export function rowText(buffer: CellBuffer, row: number): string {
    let result = ''
    for (let col = 0; col < buffer.width; col++) {
        result += buffer.getCell(col, row)?.char ?? ' '
    }
    return result.trimEnd()
}

/** Extract characters from a specific region. */
export function regionText(buffer: CellBuffer, x: number, y: number, width: number): string {
    let result = ''
    for (let col = x; col < x + width; col++) {
        result += buffer.getCell(col, y)?.char ?? ' '
    }
    return result
}
