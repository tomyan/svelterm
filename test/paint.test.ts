import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { paint } from '../src/render/paint.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle, resolveStyles } from '../src/css/compute.js'
import { parseCSS } from '../src/css/parser.js'
import { computeLayout } from '../src/layout/engine.js'
import type { ResolvedStyle } from '../src/css/compute.js'

function renderWithCSS(css: string, buildTree: (root: TermNode) => void, width = 40, height = 10) {
    const root = new TermNode('element', 'root')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    buildTree(root)

    const stylesheet = parseCSS(css)
    const resolved = resolveStyles(root, stylesheet)
    // Merge default styles for nodes without CSS rules
    for (const [id, style] of styles) {
        if (!resolved.has(id)) resolved.set(id, style)
    }
    // Add root
    if (!resolved.has(root.id)) resolved.set(root.id, defaultStyle('div'))

    const layout = computeLayout(root, resolved, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, resolved, layout)
    return buffer
}

describe('paint', () => {

    describe('text rendering', () => {
        it('renders text at layout position', () => {
            const buffer = renderWithCSS('', (root) => {
                const text = new TermNode('text', 'Hello')
                root.insertBefore(text, null)
            })
            assert.equal(buffer.getCell(0, 0)?.char, 'H')
            assert.equal(buffer.getCell(4, 0)?.char, 'o')
        })

        it('does not render empty text', () => {
            const buffer = renderWithCSS('', (root) => {
                const text = new TermNode('text', '')
                root.insertBefore(text, null)
            })
            assert.equal(buffer.getCell(0, 0)?.char, ' ')
        })

        it('skips comment nodes', () => {
            const buffer = renderWithCSS('', (root) => {
                const comment = new TermNode('comment', 'anchor')
                root.insertBefore(comment, null)
                const text = new TermNode('text', 'Hi')
                root.insertBefore(text, null)
            })
            assert.equal(buffer.getCell(0, 0)?.char, 'H')
        })
    })

    describe('background fill', () => {
        it('fills element background when bg is set', () => {
            const buffer = renderWithCSS('.box{background-color:blue;width:5px;height:3px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
            assert.equal(buffer.getCell(4, 0)?.bg, 'blue')
            assert.equal(buffer.getCell(0, 2)?.bg, 'blue')
            assert.equal(buffer.getCell(5, 0)?.bg, 'default') // outside box
        })

        it('does not fill when bg is default', () => {
            const buffer = renderWithCSS('.box{width:5px;height:3px}', (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                root.insertBefore(box, null)
            })
            assert.equal(buffer.getCell(0, 0)?.bg, 'default')
        })
    })

    describe('style inheritance', () => {
        it('child text inherits fg color from parent element', () => {
            const buffer = renderWithCSS('.parent{color:cyan}', (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const text = new TermNode('text', 'Hi')
                parent.insertBefore(text, null)
                root.insertBefore(parent, null)
            })
            assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
            assert.equal(buffer.getCell(1, 0)?.fg, 'cyan')
        })

        it('grandchild inherits from grandparent', () => {
            const buffer = renderWithCSS('.top{color:red}', (root) => {
                const top = new TermNode('element', 'div')
                top.attributes.set('class', 'top')
                const mid = new TermNode('element', 'span')
                const text = new TermNode('text', 'Deep')
                mid.insertBefore(text, null)
                top.insertBefore(mid, null)
                root.insertBefore(top, null)
            })
            assert.equal(buffer.getCell(0, 0)?.fg, 'red')
        })

        it('child overrides inherited color', () => {
            const buffer = renderWithCSS('.parent{color:red}.child{color:green}', (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const child = new TermNode('element', 'span')
                child.attributes.set('class', 'child')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                parent.insertBefore(child, null)
                root.insertBefore(parent, null)
            })
            assert.equal(buffer.getCell(0, 0)?.fg, 'green')
        })

        it('bold inherits from parent', () => {
            const buffer = renderWithCSS('.parent{font-weight:700}', (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const text = new TermNode('text', 'Bold')
                parent.insertBefore(text, null)
                root.insertBefore(parent, null)
            })
            assert.equal(buffer.getCell(0, 0)?.bold, true)
        })

        it('bg inherits from parent to text', () => {
            const buffer = renderWithCSS('.parent{background-color:blue;width:10px;height:3px}', (root) => {
                const parent = new TermNode('element', 'div')
                parent.attributes.set('class', 'parent')
                const text = new TermNode('text', 'On blue')
                parent.insertBefore(text, null)
                root.insertBefore(parent, null)
            })
            // Text cells should have inherited bg
            assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
            assert.equal(buffer.getCell(0, 0)?.char, 'O')
        })
    })

    describe('without styles or layout', () => {
        it('renders text at origin when no layout provided', () => {
            const root = new TermNode('element', 'root')
            const text = new TermNode('text', 'Plain')
            root.insertBefore(text, null)

            const buffer = new CellBuffer(20, 5)
            paint(root, buffer)
            assert.equal(buffer.getCell(0, 0)?.char, 'P')
            assert.equal(buffer.getCell(4, 0)?.char, 'n')
        })
    })
})
