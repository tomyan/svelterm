import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DomDomain } from '../src/debug/dom.js'
import { CssDomain } from '../src/debug/css.js'
import { TermNode } from '../src/renderer/node.js'
import { defaultStyle } from '../src/css/compute.js'
import type { ResolvedStyle } from '../src/css/compute.js'
import type { LayoutBox } from '../src/layout/engine.js'

function tree() {
    const root = new TermNode('element', 'root')
    const card = new TermNode('element', 'div')
    card.attributes.set('class', 'card')
    card.attributes.set('id', 'main')
    const label = new TermNode('element', 'span')
    const text = new TermNode('text', 'Hi')
    label.insertBefore(text, null)
    card.insertBefore(label, null)
    root.insertBefore(card, null)
    return { root, card, label, text }
}

function contextOf(root: TermNode) {
    const card = root.children[0]
    const label = card.children[0]
    const styles = new Map<number, ResolvedStyle>()
    styles.set(card.id, { ...defaultStyle('div'), fg: 'cyan', width: 20 })
    styles.set(label.id, defaultStyle('span'))
    const layout = new Map<number, LayoutBox>()
    layout.set(root.id, { x: 0, y: 0, width: 40, height: 10 })
    layout.set(card.id, { x: 0, y: 0, width: 20, height: 3 })
    layout.set(label.id, { x: 1, y: 1, width: 2, height: 1 })
    return {
        root,
        styles: () => styles,
        layout: () => layout,
    }
}

describe('DomDomain', () => {

    it('getDocument returns the tree with tags, attributes, and ids', () => {
        // Given
        const { root } = tree()
        const dom = new DomDomain(contextOf(root))

        // When
        const doc = dom.handle('getDocument', {})

        // Then
        assert.equal(doc.root.tag, 'root')
        const card = doc.root.children[0]
        assert.equal(card.tag, 'div')
        assert.equal(card.attributes.class, 'card')
        assert.equal(card.attributes.id, 'main')
        assert.equal(card.children[0].tag, 'span')
    })

    it('querySelector finds a node by class and returns its id', () => {
        // Given
        const { root, card } = tree()
        const dom = new DomDomain(contextOf(root))

        // When
        const result = dom.handle('querySelector', { selector: '.card' })

        // Then
        assert.equal(result.nodeId, card.id)
    })

    it('getBoxModel returns the node layout box', () => {
        // Given
        const { root, card } = tree()
        const dom = new DomDomain(contextOf(root))

        // When
        const box = dom.handle('getBoxModel', { nodeId: card.id })

        // Then
        assert.deepEqual(box, { x: 0, y: 0, width: 20, height: 3 })
    })

    it('setAttribute mutates the node', () => {
        // Given
        const { root, card } = tree()
        const dom = new DomDomain(contextOf(root))

        // When
        dom.handle('setAttribute', { nodeId: card.id, name: 'data-x', value: '1' })

        // Then
        assert.equal(card.attributes.get('data-x'), '1')
    })
})

describe('CssDomain', () => {

    it('getComputedStyle returns the resolved style for a node', () => {
        // Given
        const { root, card } = tree()
        const css = new CssDomain(contextOf(root))

        // When
        const result = css.handle('getComputedStyle', { nodeId: card.id })

        // Then
        assert.equal(result.style.fg, 'cyan')
        assert.equal(result.style.width, 20)
    })

    it('reports an error for an unknown node', () => {
        const { root } = tree()
        const css = new CssDomain(contextOf(root))
        assert.throws(() => css.handle('getComputedStyle', { nodeId: 99999 }), /node/i)
    })
})
