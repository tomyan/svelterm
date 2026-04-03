import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyScrollInput } from '../src/input/scroll.js'
import { TermNode } from '../src/renderer/node.js'

describe('applyScrollInput', () => {

    function makeScrollable(contentHeight: number, viewportHeight: number): TermNode {
        const node = new TermNode('element', 'div')
        node.attributes.set('data-content-height', String(contentHeight))
        node.attributes.set('data-viewport-height', String(viewportHeight))
        return node
    }

    it('ArrowDown increments scrollTop by 1', () => {
        const node = makeScrollable(20, 5)
        node.scrollTop = 0
        applyScrollInput(node, 'ArrowDown', 20, 5)
        assert.equal(node.scrollTop, 1)
    })

    it('ArrowUp decrements scrollTop by 1', () => {
        const node = makeScrollable(20, 5)
        node.scrollTop = 5
        applyScrollInput(node, 'ArrowUp', 20, 5)
        assert.equal(node.scrollTop, 4)
    })

    it('ArrowUp does not go below 0', () => {
        const node = makeScrollable(20, 5)
        node.scrollTop = 0
        applyScrollInput(node, 'ArrowUp', 20, 5)
        assert.equal(node.scrollTop, 0)
    })

    it('ArrowDown does not exceed content - viewport', () => {
        const node = makeScrollable(10, 5)
        node.scrollTop = 5
        applyScrollInput(node, 'ArrowDown', 10, 5)
        assert.equal(node.scrollTop, 5)
    })

    it('PageDown scrolls by viewport height', () => {
        const node = makeScrollable(30, 5)
        node.scrollTop = 0
        applyScrollInput(node, 'PageDown', 30, 5)
        assert.equal(node.scrollTop, 5)
    })

    it('PageUp scrolls up by viewport height', () => {
        const node = makeScrollable(30, 5)
        node.scrollTop = 10
        applyScrollInput(node, 'PageUp', 30, 5)
        assert.equal(node.scrollTop, 5)
    })

    it('PageUp clamps to 0', () => {
        const node = makeScrollable(30, 5)
        node.scrollTop = 2
        applyScrollInput(node, 'PageUp', 30, 5)
        assert.equal(node.scrollTop, 0)
    })

    it('ignores non-scroll keys', () => {
        const node = makeScrollable(20, 5)
        node.scrollTop = 3
        applyScrollInput(node, 'a', 20, 5)
        assert.equal(node.scrollTop, 3)
    })
})
