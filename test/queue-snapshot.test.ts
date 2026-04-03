import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RenderQueue } from '../src/render/queue.js'
import { TermNode } from '../src/renderer/node.js'

describe('RenderQueue.snapshot', () => {

    it('returns a copy with the same nodes', () => {
        const queue = new RenderQueue()
        const node = new TermNode('text', 'hello')
        queue.enqueuePaintOnly(node)

        const snap = queue.snapshot()
        assert.equal(snap.paintOnly.has(node), true)
    })

    it('clears the original queue after snapshot', () => {
        const queue = new RenderQueue()
        const node = new TermNode('text', 'hello')
        queue.enqueuePaintOnly(node)

        queue.snapshot()
        assert.equal(queue.isEmpty(), true)
    })

    it('mutations to original do not affect snapshot', () => {
        const queue = new RenderQueue()
        const a = new TermNode('text', 'a')
        const b = new TermNode('text', 'b')
        queue.enqueuePaintOnly(a)

        const snap = queue.snapshot()
        queue.enqueuePaintOnly(b)

        assert.equal(snap.paintOnly.has(a), true)
        assert.equal(snap.paintOnly.has(b), false)
    })

    it('preserves fullRecompute flag in snapshot', () => {
        const queue = new RenderQueue()
        queue.setFullRecompute()

        const snap = queue.snapshot()
        assert.equal(snap.fullRecompute, true)
        assert.equal(queue.fullRecompute, false)
    })

    it('copies all queue categories', () => {
        const queue = new RenderQueue()
        const a = new TermNode('element', 'div')
        const b = new TermNode('text', 'text')
        const c = new TermNode('element', 'span')
        const d = new TermNode('element', 'p')

        queue.enqueueStyleResolve(a)
        queue.enqueueLayoutSubtree(b)
        queue.enqueueLayoutBubble(c)
        queue.enqueuePaintOnly(d)

        const snap = queue.snapshot()
        assert.equal(snap.styleResolve.has(a), true)
        assert.equal(snap.layoutSubtree.has(b), true)
        assert.equal(snap.layoutBubble.has(c), true)
        assert.equal(snap.paintOnly.has(d), true)
    })
})
