import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 40, height = 5) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('CSS custom properties (variables)', () => {

    it('var() resolves from :root', () => {
        const buffer = render(
            ':root{--primary:cyan}.title{color:var(--primary)}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 'title')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })

    it('var() with fallback uses fallback when variable undefined', () => {
        const buffer = render(
            '.title{color:var(--missing, red)}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 'title')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'red')
    })

    it('var() with fallback uses variable when defined', () => {
        const buffer = render(
            ':root{--accent:green}.title{color:var(--accent, red)}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 'title')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('variables defined on element apply to descendants', () => {
        const buffer = render(
            '.container{--fg:yellow}.child{color:var(--fg)}',
            (root) => {
                const container = new TermNode('element', 'div')
                container.attributes.set('class', 'container')
                const child = new TermNode('element', 'span')
                child.attributes.set('class', 'child')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                container.insertBefore(child, null)
                root.insertBefore(container, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'yellow')
    })

    it('child can override parent variable', () => {
        const buffer = render(
            ':root{--color:red}.override{--color:blue}.text{color:var(--color)}',
            (root) => {
                const override = new TermNode('element', 'div')
                override.attributes.set('class', 'override')
                const child = new TermNode('element', 'span')
                child.attributes.set('class', 'text')
                const text = new TermNode('text', 'Hi')
                child.insertBefore(text, null)
                override.insertBefore(child, null)
                root.insertBefore(override, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'blue')
    })

    it('multiple variables in one stylesheet', () => {
        const buffer = render(
            ':root{--fg:cyan;--bg:blue}.box{color:var(--fg);background-color:var(--bg);width:5cell;height:1cell}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hi')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
        assert.equal(buffer.getCell(0, 0)?.bg, 'blue')
    })

    it('var() in non-color property (padding)', () => {
        const buffer = render(
            ':root{--pad:2cell}.box{padding-left:var(--pad)}',
            (root) => {
                const box = new TermNode('element', 'div')
                box.attributes.set('class', 'box')
                const text = new TermNode('text', 'Hi')
                box.insertBefore(text, null)
                root.insertBefore(box, null)
            },
        )
        assert.equal(buffer.getCell(0, 0)?.char, ' ')
        assert.equal(buffer.getCell(1, 0)?.char, ' ')
        assert.equal(buffer.getCell(2, 0)?.char, 'H')
    })
})
