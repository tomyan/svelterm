import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { insertWithContext } from '../src/renderer/index.js'
import { RenderContext } from '../src/render/context.js'

// Svelte appends {#if}/{#each}/component content as a FRAGMENT whose
// children move into the parent; the fragment itself never joins the
// tree. Style resolution must be enqueued for the nodes that actually
// landed, not the emptied fragment — this was the bug that left every
// post-mount insertion unstyled.
describe('fragment insertion enqueues styles for real children', () => {

    it('enqueues the fragment children, not the fragment', () => {
        // Given: a live parent and a fragment [text, div.boxed, text]
        const ctx = new RenderContext()
        const parent = new TermNode('element', 'root')
        parent.ctx = ctx

        const fragment = new TermNode('fragment')
        const before = new TermNode('text', ' ')
        const boxed = new TermNode('element', 'div')
        boxed.attributes.set('class', 'boxed')
        const after = new TermNode('text', ' ')
        for (const n of [before, boxed, after]) fragment.insertBefore(n, null)

        // When
        insertWithContext(parent, fragment, null)

        // Then: the div is queued for style resolution; the fragment is not
        const snap = ctx.queue.snapshot()
        const queued = [...snap.styleResolve]
        assert.ok(queued.includes(boxed), 'inserted element must be queued')
        assert.ok(!queued.includes(fragment), 'emptied fragment must not be queued')
    })

    it('a plain element insert still enqueues that element', () => {
        const ctx = new RenderContext()
        const parent = new TermNode('element', 'root')
        parent.ctx = ctx
        const child = new TermNode('element', 'div')

        insertWithContext(parent, child, null)

        const queued = [...ctx.queue.snapshot().styleResolve]
        assert.ok(queued.includes(child))
    })

    it('nested fragments enqueue their leaf elements', () => {
        const ctx = new RenderContext()
        const parent = new TermNode('element', 'root')
        parent.ctx = ctx

        const outer = new TermNode('fragment')
        const inner = new TermNode('fragment')
        const leaf = new TermNode('element', 'span')
        inner.insertBefore(leaf, null)
        outer.insertBefore(inner, null)

        insertWithContext(parent, outer, null)

        const queued = [...ctx.queue.snapshot().styleResolve]
        assert.ok(queued.includes(leaf), 'leaf element inside nested fragments must be queued')
    })
})
