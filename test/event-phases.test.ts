import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { dispatchEvent } from '../src/input/dispatch.js'

describe('event dispatch phases', () => {

    it('bubble phase: events fire from target up to root', () => {
        // Given
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)

        const order: string[] = []
        child.listeners.set('click', new Set([() => order.push('child')]))
        parent.listeners.set('click', new Set([() => order.push('parent')]))
        root.listeners.set('click', new Set([() => order.push('root')]))

        // When
        dispatchEvent(child, 'click')

        // Then: child → parent → root
        assert.deepEqual(order, ['child', 'parent', 'root'])
    })

    it('capture phase: events fire from root down to target', () => {
        // Given
        const root = new TermNode('element', 'root')
        const parent = new TermNode('element', 'div')
        const child = new TermNode('element', 'button')
        parent.insertBefore(child, null)
        root.insertBefore(parent, null)

        const order: string[] = []
        // Register capture listeners (event type + 'capture' suffix convention,
        // or use a separate captureListeners map)
        root.listeners.set('click__capture', new Set([() => order.push('root-capture')]))
        parent.listeners.set('click__capture', new Set([() => order.push('parent-capture')]))
        child.listeners.set('click', new Set([() => order.push('child-target')]))
        parent.listeners.set('click', new Set([() => order.push('parent-bubble')]))
        root.listeners.set('click', new Set([() => order.push('root-bubble')]))

        // When
        dispatchEvent(child, 'click')

        // Then: capture (root → parent) → target → bubble (parent → root)
        assert.deepEqual(order, [
            'root-capture', 'parent-capture',
            'child-target',
            'parent-bubble', 'root-bubble',
        ])
    })

    it('stopPropagation in capture prevents target and bubble', () => {
        // Given
        const root = new TermNode('element', 'root')
        const child = new TermNode('element', 'div')
        root.insertBefore(child, null)

        const order: string[] = []
        root.listeners.set('click__capture', new Set([(e: any) => {
            order.push('root-capture')
            e.stopPropagation()
        }]))
        child.listeners.set('click', new Set([() => order.push('child')]))
        root.listeners.set('click', new Set([() => order.push('root-bubble')]))

        // When
        dispatchEvent(child, 'click')

        // Then: only capture fires
        assert.deepEqual(order, ['root-capture'])
    })

    it('event dispatched to root fires on root as target', () => {
        // Given
        const root = new TermNode('element', 'root')
        let fired = false
        root.listeners.set('keydown', new Set([() => { fired = true }]))

        // When
        dispatchEvent(root, 'keydown', { key: 'a' })

        // Then
        assert.equal(fired, true)
    })
})
