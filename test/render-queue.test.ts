import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RenderQueue } from '../src/render/queue.js'
import { TermNode } from '../src/renderer/node.js'

describe('RenderQueue', () => {

    it('starts empty', () => {
        const q = new RenderQueue()
        assert.ok(q.isEmpty())
    })

    it('enqueuePaintOnly adds to paint set', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueuePaintOnly(node)
        assert.ok(!q.isEmpty())
        assert.ok(q.paintOnly.has(node))
    })

    it('enqueueStyleResolve adds to style set', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueueStyleResolve(node)
        assert.ok(q.styleResolve.has(node))
    })

    it('enqueueLayoutSubtree adds to layout set', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueueLayoutSubtree(node)
        assert.ok(q.layoutSubtree.has(node))
    })

    it('enqueueLayoutBubble adds to bubble set', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueueLayoutBubble(node)
        assert.ok(q.layoutBubble.has(node))
    })

    it('setFullRecompute marks full', () => {
        const q = new RenderQueue()
        q.setFullRecompute()
        assert.ok(q.fullRecompute)
    })

    it('clear resets everything', () => {
        const q = new RenderQueue()
        q.enqueuePaintOnly(new TermNode('element', 'div'))
        q.enqueueStyleResolve(new TermNode('element', 'div'))
        q.setFullRecompute()
        q.clear()
        assert.ok(q.isEmpty())
        assert.ok(!q.fullRecompute)
    })

    it('deduplicates same node', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueuePaintOnly(node)
        q.enqueuePaintOnly(node)
        assert.equal(q.paintOnly.size, 1)
    })

    it('style resolve subsumes paint only for same node', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueuePaintOnly(node)
        q.enqueueStyleResolve(node)
        // paintOnly should be removed since styleResolve is more comprehensive
        assert.ok(!q.paintOnly.has(node))
        assert.ok(q.styleResolve.has(node))
    })

    it('layout subsumes paint only for same node', () => {
        const q = new RenderQueue()
        const node = new TermNode('element', 'div')
        q.enqueuePaintOnly(node)
        q.enqueueLayoutSubtree(node)
        assert.ok(!q.paintOnly.has(node))
        assert.ok(q.layoutSubtree.has(node))
    })

    it('fullRecompute subsumes everything', () => {
        const q = new RenderQueue()
        q.enqueuePaintOnly(new TermNode('element', 'div'))
        q.enqueueStyleResolve(new TermNode('element', 'span'))
        q.setFullRecompute()
        // Individual items don't matter when full recompute is set
        assert.ok(q.fullRecompute)
    })
})
