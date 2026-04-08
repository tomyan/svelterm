import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTermRenderer } from '../src/renderer/index.js'
import { TermNode } from '../src/renderer/node.js'
import { RenderContext } from '../src/render/context.js'

describe('renderer with node-owned ctx', () => {
    const renderer = createTermRenderer()

    function rootWithCtx(): { root: TermNode; ctx: RenderContext } {
        const ctx = new RenderContext()
        const root = new TermNode('element', 'root')
        root.ctx = ctx
        return { root, ctx }
    }

    describe('setText', () => {
        it('enqueues paint when text length unchanged and node has ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const text = renderer.createTextNode('abc')
            renderer.insert(root, text, null)
            ctx.queue.clear()

            // When
            renderer.setText(text, 'xyz')

            // Then
            assert.equal(text.text, 'xyz')
            assert.ok(ctx.queue.paintOnly.has(text))
        })

        it('enqueues layout bubble when text length changes and node has ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const text = renderer.createTextNode('ab')
            renderer.insert(root, text, null)
            ctx.queue.clear()

            // When
            renderer.setText(text, 'abcd')

            // Then
            assert.equal(text.text, 'abcd')
            assert.ok(ctx.queue.layoutBubble.has(text))
        })

        it('sets text directly when node has no ctx', () => {
            // Given
            const text = renderer.createTextNode('old')

            // When
            renderer.setText(text, 'new')

            // Then
            assert.equal(text.text, 'new')
        })
    })

    describe('setAttribute', () => {
        it('enqueues style resolve for class change when node has ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const el = renderer.createElement('div')
            renderer.insert(root, el, null)
            ctx.queue.clear()

            // When
            renderer.setAttribute(el, 'class', 'foo')

            // Then
            assert.equal(renderer.getAttribute(el, 'class'), 'foo')
            assert.ok(ctx.queue.styleResolve.has(el))
        })

        it('enqueues paint for non-style attribute when node has ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const el = renderer.createElement('div')
            renderer.insert(root, el, null)
            ctx.queue.clear()

            // When
            renderer.setAttribute(el, 'data-value', '42')

            // Then
            assert.equal(renderer.getAttribute(el, 'data-value'), '42')
            assert.ok(ctx.queue.paintOnly.has(el))
        })

        it('sets attribute directly when node has no ctx', () => {
            // Given
            const el = renderer.createElement('div')

            // When
            renderer.setAttribute(el, 'class', 'bar')

            // Then
            assert.equal(renderer.getAttribute(el, 'class'), 'bar')
        })
    })

    describe('removeAttribute', () => {
        it('enqueues style resolve for class removal when node has ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const el = renderer.createElement('div')
            renderer.insert(root, el, null)
            renderer.setAttribute(el, 'class', 'foo')
            ctx.queue.clear()

            // When
            renderer.removeAttribute(el, 'class')

            // Then
            assert.ok(!renderer.hasAttribute(el, 'class'))
            assert.ok(ctx.queue.styleResolve.has(el))
        })

        it('removes attribute directly when node has no ctx', () => {
            // Given
            const el = renderer.createElement('div')
            renderer.setAttribute(el, 'class', 'foo')

            // When
            renderer.removeAttribute(el, 'class')

            // Then
            assert.ok(!renderer.hasAttribute(el, 'class'))
        })
    })

    describe('insert', () => {
        it('enqueues style resolve on child and layout on parent when ctx', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const child = renderer.createElement('div')

            // When
            renderer.insert(root, child, null)

            // Then
            assert.ok(ctx.queue.styleResolve.has(child))
            assert.ok(
                ctx.queue.layoutSubtree.has(root) || ctx.queue.layoutBubble.has(root),
                'parent should have layout work enqueued',
            )
        })
    })

    describe('remove', () => {
        it('enqueues layout work on parent when node with ctx is removed', () => {
            // Given
            const { root, ctx } = rootWithCtx()
            const child = renderer.createElement('div')
            renderer.insert(root, child, null)
            ctx.queue.clear()

            // When
            renderer.remove(child)

            // Then
            assert.ok(
                ctx.queue.layoutSubtree.has(root) || ctx.queue.layoutBubble.has(root) || ctx.queue.paintOnly.has(root),
                'parent should have work enqueued after child removal',
            )
        })
    })
})
