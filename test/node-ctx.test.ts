import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { RenderContext } from '../src/render/context.js'

describe('TermNode ctx propagation', () => {
    describe('insert propagates ctx to children', () => {
        it('propagates ctx when inserting a node into a tree with ctx', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx
            const child = new TermNode('element', 'div')

            // When
            root.insertBefore(child, null)

            // Then
            assert.equal(child.ctx, ctx)
        })

        it('propagates ctx to deeply nested descendants', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx

            const parent = new TermNode('element', 'div')
            const child = new TermNode('element', 'span')
            const text = new TermNode('text', 'hello')
            parent.insertBefore(child, null)
            child.insertBefore(text, null)

            // When
            root.insertBefore(parent, null)

            // Then
            assert.equal(parent.ctx, ctx)
            assert.equal(child.ctx, ctx)
            assert.equal(text.ctx, ctx)
        })

        it('propagates ctx through fragment expansion', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx

            const frag = new TermNode('fragment')
            const a = new TermNode('element', 'div')
            const b = new TermNode('element', 'span')
            frag.insertBefore(a, null)
            frag.insertBefore(b, null)

            // When
            root.insertBefore(frag, null)

            // Then
            assert.equal(a.ctx, ctx)
            assert.equal(b.ctx, ctx)
        })

        it('does not propagate ctx when parent has no ctx', () => {
            // Given
            const parent = new TermNode('element', 'div')
            const child = new TermNode('element', 'span')

            // When
            parent.insertBefore(child, null)

            // Then
            assert.equal(child.ctx, null)
        })
    })

    describe('remove clears ctx', () => {
        it('clears ctx when node is removed from tree', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx
            const child = new TermNode('element', 'div')
            root.insertBefore(child, null)
            assert.equal(child.ctx, ctx)

            // When
            root.removeChild(child)

            // Then
            assert.equal(child.ctx, null)
        })

        it('clears ctx on descendants when removed', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx
            const parent = new TermNode('element', 'div')
            const child = new TermNode('element', 'span')
            const text = new TermNode('text', 'hello')
            parent.insertBefore(child, null)
            child.insertBefore(text, null)
            root.insertBefore(parent, null)
            assert.equal(text.ctx, ctx)

            // When
            root.removeChild(parent)

            // Then
            assert.equal(parent.ctx, null)
            assert.equal(child.ctx, null)
            assert.equal(text.ctx, null)
        })
    })

    describe('re-parenting updates ctx', () => {
        it('updates ctx when moving node between trees', () => {
            // Given
            const ctx1 = new RenderContext()
            const ctx2 = new RenderContext()
            const root1 = new TermNode('element', 'root1')
            root1.ctx = ctx1
            const root2 = new TermNode('element', 'root2')
            root2.ctx = ctx2
            const child = new TermNode('element', 'div')
            root1.insertBefore(child, null)
            assert.equal(child.ctx, ctx1)

            // When
            root2.insertBefore(child, null)

            // Then
            assert.equal(child.ctx, ctx2)
        })
    })

    describe('cleanup clears ctx', () => {
        it('clears ctx on cleanup', () => {
            // Given
            const ctx = new RenderContext()
            const root = new TermNode('element', 'root')
            root.ctx = ctx
            const child = new TermNode('element', 'div')
            root.insertBefore(child, null)

            // When
            root.cleanup()

            // Then
            assert.equal(root.ctx, null)
            assert.equal(child.ctx, null)
        })
    })
})
