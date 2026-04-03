import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { dispatchEvent, type TermEvent } from '../src/input/dispatch.js'
import { TermNode } from '../src/renderer/node.js'

describe('dispatchEvent', () => {

    it('calls listener registered on target node', () => {
        const node = new TermNode('element', 'button')
        let called = false
        node.listeners.set('click', new Set([() => { called = true }]))

        dispatchEvent(node, 'click')
        assert.ok(called)
    })

    it('passes event object to listener', () => {
        const node = new TermNode('element', 'button')
        let received: TermEvent | null = null
        node.listeners.set('keydown', new Set([(e: TermEvent) => { received = e }]))

        dispatchEvent(node, 'keydown', { key: 'Enter' })
        assert.ok(received)
        assert.equal((received as TermEvent).type, 'keydown')
        assert.equal((received as TermEvent).data?.key, 'Enter')
        assert.equal((received as TermEvent).target, node)
    })

    it('calls all listeners for the event type', () => {
        const node = new TermNode('element', 'button')
        let count = 0
        node.listeners.set('click', new Set([
            () => { count++ },
            () => { count++ },
        ]))

        dispatchEvent(node, 'click')
        assert.equal(count, 2)
    })

    it('does nothing when no listeners for event type', () => {
        const node = new TermNode('element', 'button')
        dispatchEvent(node, 'click') // should not throw
    })

    it('bubbles to parent', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)

        let parentCalled = false
        parent.listeners.set('click', new Set([() => { parentCalled = true }]))

        dispatchEvent(child, 'click')
        assert.ok(parentCalled)
    })

    it('calls child listener before parent', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)

        const order: string[] = []
        child.listeners.set('click', new Set([() => { order.push('child') }]))
        parent.listeners.set('click', new Set([() => { order.push('parent') }]))

        dispatchEvent(child, 'click')
        assert.deepEqual(order, ['child', 'parent'])
    })

    it('stopPropagation prevents bubbling', () => {
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)

        let parentCalled = false
        child.listeners.set('click', new Set([(e: TermEvent) => { e.stopPropagation() }]))
        parent.listeners.set('click', new Set([() => { parentCalled = true }]))

        dispatchEvent(child, 'click')
        assert.ok(!parentCalled, 'parent should not be called after stopPropagation')
    })

    it('preventDefault sets flag on event', () => {
        const node = new TermNode('element', 'button')
        node.listeners.set('click', new Set([(e: TermEvent) => { e.preventDefault() }]))

        const event = dispatchEvent(node, 'click')
        assert.ok(event.defaultPrevented)
    })
})
