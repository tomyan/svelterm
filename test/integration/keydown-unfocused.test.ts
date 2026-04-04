import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { el, text } from './harness.js'
import { dispatchEvent } from '../../src/input/dispatch.js'

describe('keydown dispatch without focus', () => {

    it('keydown on root bubbles to parent listeners', () => {
        // Given: a div with a keydown listener, no focused element
        const root = el('div', { class: 'game' }, [
            el('span', {}, [text('content')]),
        ])

        let received: any = null
        root.listeners.set('keydown', new Set([(e: any) => { received = e.data }]))

        // When: dispatch keydown to the root (simulating unfocused key press)
        dispatchEvent(root, 'keydown', { key: 'ArrowUp' })

        // Then: handler receives the key
        assert.deepEqual(received, { key: 'ArrowUp' })
    })

    it('keydown dispatched to deepest element bubbles up', () => {
        // Given
        const root = el('div', {}, [])
        const child = el('div', { class: 'game' }, [text('game')])
        root.insertBefore(child, null)

        const received: string[] = []
        child.listeners.set('keydown', new Set([() => received.push('child')]))
        root.listeners.set('keydown', new Set([() => received.push('root')]))

        // When: dispatch to child
        dispatchEvent(child, 'keydown', { key: 'a' })

        // Then: bubbles up
        assert.deepEqual(received, ['child', 'root'])
    })
})
