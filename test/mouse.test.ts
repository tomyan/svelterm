import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseMouseEvent, type MouseEvent } from '../src/input/mouse.js'
import { hitTest } from '../src/input/hit.js'
import { TermNode } from '../src/renderer/node.js'
import { LayoutBox } from '../src/layout/engine.js'

describe('parseMouseEvent', () => {

    // SGR format: ESC [ < button ; col ; row M (press) or m (release)
    it('parses left click press', () => {
        // ESC [ < 0 ; 5 ; 3 M — left button press at col 5, row 3
        const evt = parseMouseEvent(Buffer.from('\x1b[<0;5;3M'))
        assert.ok(evt)
        assert.equal(evt!.button, 'left')
        assert.equal(evt!.type, 'press')
        assert.equal(evt!.col, 4) // 0-indexed
        assert.equal(evt!.row, 2) // 0-indexed
    })

    it('parses left click release', () => {
        const evt = parseMouseEvent(Buffer.from('\x1b[<0;5;3m'))
        assert.ok(evt)
        assert.equal(evt!.button, 'left')
        assert.equal(evt!.type, 'release')
    })

    it('parses right click', () => {
        const evt = parseMouseEvent(Buffer.from('\x1b[<2;10;5M'))
        assert.ok(evt)
        assert.equal(evt!.button, 'right')
    })

    it('parses middle click', () => {
        const evt = parseMouseEvent(Buffer.from('\x1b[<1;10;5M'))
        assert.ok(evt)
        assert.equal(evt!.button, 'middle')
    })

    it('parses scroll up', () => {
        const evt = parseMouseEvent(Buffer.from('\x1b[<64;10;5M'))
        assert.ok(evt)
        assert.equal(evt!.button, 'scrollUp')
    })

    it('parses scroll down', () => {
        const evt = parseMouseEvent(Buffer.from('\x1b[<65;10;5M'))
        assert.ok(evt)
        assert.equal(evt!.button, 'scrollDown')
    })

    it('returns null for non-mouse input', () => {
        assert.equal(parseMouseEvent(Buffer.from('a')), null)
        assert.equal(parseMouseEvent(Buffer.from('\x1b[A')), null)
    })
})

describe('hitTest', () => {

    it('finds the deepest element at a given position', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)

        const layout = new Map<number, LayoutBox>()
        layout.set(parent.id, { x: 0, y: 0, width: 20, height: 10 })
        layout.set(child.id, { x: 2, y: 2, width: 10, height: 3 })

        // Click inside child
        assert.equal(hitTest(parent, layout, 5, 3), child)

        // Click outside child but inside parent
        assert.equal(hitTest(parent, layout, 0, 0), parent)
    })

    it('returns null when click is outside all elements', () => {
        const root = new TermNode('element', 'div')
        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 10, height: 5 })

        assert.equal(hitTest(root, layout, 15, 8), null)
    })

    it('prefers deeper nested element', () => {
        const root = new TermNode('element', 'div')
        const mid = new TermNode('element', 'div')
        const leaf = new TermNode('element', 'button')
        root.insertBefore(mid, null)
        mid.insertBefore(leaf, null)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 10 })
        layout.set(mid.id, { x: 1, y: 1, width: 18, height: 8 })
        layout.set(leaf.id, { x: 2, y: 2, width: 10, height: 3 })

        assert.equal(hitTest(root, layout, 5, 3), leaf)
    })

    it('skips text and comment nodes', () => {
        const root = new TermNode('element', 'div')
        const text = new TermNode('text', 'Hello')
        root.insertBefore(text, null)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 5 })
        layout.set(text.id, { x: 0, y: 0, width: 5, height: 1 })

        // Should return root (element), not text node
        assert.equal(hitTest(root, layout, 2, 0), root)
    })
})
