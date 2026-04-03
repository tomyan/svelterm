import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RenderContext } from '../src/render/context.js'
import { RenderQueue } from '../src/render/queue.js'
import { TermNode } from '../src/renderer/node.js'

describe('RenderContext mutation routing', () => {

    it('setText with same length enqueues paint-only', () => {
        const ctx = new RenderContext()
        const node = new TermNode('text', 'Hello')
        node.cache.layoutBox = { x: 0, y: 0, width: 5, height: 1 }

        ctx.onSetText(node, 'World')
        assert.ok(ctx.queue.paintOnly.has(node))
        assert.ok(!ctx.queue.layoutBubble.has(node))
    })

    it('setText with different length enqueues layout-bubble', () => {
        const ctx = new RenderContext()
        const node = new TermNode('text', 'Hi')
        node.cache.layoutBox = { x: 0, y: 0, width: 2, height: 1 }

        ctx.onSetText(node, 'Hello World')
        assert.ok(ctx.queue.layoutBubble.has(node))
    })

    it('setAttribute class enqueues style-resolve', () => {
        const ctx = new RenderContext()
        const node = new TermNode('element', 'div')
        node.cache.classAttr = 'old'

        ctx.onSetAttribute(node, 'class', 'new')
        assert.ok(ctx.queue.styleResolve.has(node))
    })

    it('setAttribute class with same value does nothing', () => {
        const ctx = new RenderContext()
        const node = new TermNode('element', 'div')
        node.cache.classAttr = 'same'

        ctx.onSetAttribute(node, 'class', 'same')
        assert.ok(ctx.queue.isEmpty())
    })

    it('setAttribute data-focused enqueues style-resolve', () => {
        const ctx = new RenderContext()
        const node = new TermNode('element', 'button')

        ctx.onSetAttribute(node, 'data-focused', 'true')
        assert.ok(ctx.queue.styleResolve.has(node))
    })

    it('setAttribute other enqueues paint-only', () => {
        const ctx = new RenderContext()
        const node = new TermNode('element', 'div')

        ctx.onSetAttribute(node, 'title', 'hello')
        assert.ok(ctx.queue.paintOnly.has(node))
    })

    it('insert enqueues layout for parent', () => {
        const ctx = new RenderContext()
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'span')

        ctx.onInsert(parent, child)
        // New node needs full computation
        assert.ok(ctx.queue.styleResolve.has(child))
        // Parent needs re-layout
        assert.ok(ctx.queue.layoutSubtree.has(parent) || ctx.queue.layoutBubble.has(parent))
    })

    it('remove enqueues layout for parent', () => {
        const ctx = new RenderContext()
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'span')
        parent.insertBefore(child, null)

        ctx.onRemove(child, parent)
        assert.ok(ctx.queue.layoutSubtree.has(parent) || ctx.queue.layoutBubble.has(parent))
    })

    it('resize sets full recompute', () => {
        const ctx = new RenderContext()
        ctx.onResize()
        assert.ok(ctx.queue.fullRecompute)
    })
})
