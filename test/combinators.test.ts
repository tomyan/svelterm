import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesSelector } from '../src/css/selector.js'
import { TermNode } from '../src/renderer/node.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function makeTree(): { root: TermNode; div: TermNode; ul: TermNode; li: TermNode; span: TermNode } {
    const root = new TermNode('element', 'div')
    root.attributes.set('class', 'root')

    const ul = new TermNode('element', 'ul')
    root.insertBefore(ul, null)

    const li = new TermNode('element', 'li')
    li.attributes.set('class', 'item')
    ul.insertBefore(li, null)

    const span = new TermNode('element', 'span')
    li.insertBefore(span, null)

    return { root, div: root, ul, li, span }
}

describe('descendant selector (space)', () => {

    it('matches element nested anywhere in ancestor', () => {
        const { root, span } = makeTree()
        assert.ok(matchesSelector(span, 'div span'))
    })

    it('matches with class on ancestor', () => {
        const { root, li } = makeTree()
        assert.ok(matchesSelector(li, '.root li'))
    })

    it('does not match when ancestor is wrong', () => {
        const { root, span } = makeTree()
        assert.ok(!matchesSelector(span, 'p span'))
    })

    it('matches deeply nested', () => {
        const { root, span } = makeTree()
        assert.ok(matchesSelector(span, 'div span')) // div > ul > li > span
    })

    it('ancestor class + descendant class', () => {
        const { root, li } = makeTree()
        assert.ok(matchesSelector(li, '.root .item'))
    })
})

describe('child selector (>)', () => {

    it('matches direct child', () => {
        const { root, ul } = makeTree()
        assert.ok(matchesSelector(ul, 'div > ul'))
    })

    it('does not match non-direct descendant', () => {
        const { root, li } = makeTree()
        assert.ok(!matchesSelector(li, 'div > li')) // li is child of ul, not div
    })

    it('matches with class', () => {
        const { root, ul, li } = makeTree()
        assert.ok(matchesSelector(li, 'ul > .item'))
    })
})

describe('combinators in style resolution', () => {

    it('descendant selector applies style', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('.container .text { color: cyan; }')

        const container = new TermNode('element', 'div')
        container.attributes.set('class', 'container')
        const inner = new TermNode('element', 'span')
        inner.attributes.set('class', 'text')
        const text = new TermNode('text', 'Hi')
        inner.insertBefore(text, null)
        container.insertBefore(inner, null)
        root.insertBefore(container, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 5)
        const buffer = new CellBuffer(40, 5)
        paint(root, buffer, styles, layout)

        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })

    it('child selector applies style', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('ul > li { color: green; }')

        const ul = new TermNode('element', 'ul')
        const li = new TermNode('element', 'li')
        const text = new TermNode('text', 'Item')
        li.insertBefore(text, null)
        ul.insertBefore(li, null)
        root.insertBefore(ul, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 5)
        const buffer = new CellBuffer(40, 5)
        paint(root, buffer, styles, layout)

        assert.equal(buffer.getCell(3, 0)?.fg, 'green') // after "•  " list marker
    })
})
