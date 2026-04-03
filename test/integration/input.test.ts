import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { el, text } from './harness.js'
import { FocusManager } from '../../src/input/focus.js'
import { dispatchEvent } from '../../src/input/dispatch.js'
import { hitTest } from '../../src/input/hit.js'
import type { LayoutBox } from '../../src/layout/engine.js'

describe('integration: input system', () => {

    it('click handler is called via dispatchEvent', () => {
        // Given
        const btn = el('button', {}, [text('Click')])
        let clicked = false
        btn.listeners.set('click', new Set([() => { clicked = true }]))

        // When
        dispatchEvent(btn, 'click')

        // Then
        assert.equal(clicked, true)
    })

    it('events bubble from child to parent', () => {
        // Given
        const parent = el('div', {}, [])
        const child = el('span', {}, [text('inner')])
        parent.insertBefore(child, null)

        const received: string[] = []
        child.listeners.set('click', new Set([() => received.push('child')]))
        parent.listeners.set('click', new Set([() => received.push('parent')]))

        // When
        dispatchEvent(child, 'click')

        // Then: child first, then parent
        assert.deepEqual(received, ['child', 'parent'])
    })

    it('stopPropagation prevents bubbling', () => {
        // Given
        const parent = el('div', {}, [])
        const child = el('span', {}, [text('inner')])
        parent.insertBefore(child, null)

        const received: string[] = []
        child.listeners.set('click', new Set([(e: any) => {
            received.push('child')
            e.stopPropagation()
        }]))
        parent.listeners.set('click', new Set([() => received.push('parent')]))

        // When
        dispatchEvent(child, 'click')

        // Then: only child received
        assert.deepEqual(received, ['child'])
    })

    it('focus manager cycles through focusable elements', () => {
        // Given
        const fm = new FocusManager()
        const a = el('button', {}, [text('A')])
        const b = el('button', {}, [text('B')])
        const c = el('button', {}, [text('C')])
        fm.register(a)
        fm.register(b)
        fm.register(c)

        // When
        fm.focusNext() // → a
        assert.equal(fm.focused, a)
        fm.focusNext() // → b
        assert.equal(fm.focused, b)
        fm.focusNext() // → c
        assert.equal(fm.focused, c)
        fm.focusNext() // → wraps to a
        assert.equal(fm.focused, a)
    })

    it('focusPrevious wraps backwards', () => {
        // Given
        const fm = new FocusManager()
        const a = el('button', {}, [text('A')])
        const b = el('button', {}, [text('B')])
        fm.register(a)
        fm.register(b)

        // When: focus previous from no focus
        fm.focusPrevious()

        // Then: wraps to last
        assert.equal(fm.focused, b)

        fm.focusPrevious()
        assert.equal(fm.focused, a)
    })

    it('hit test finds deepest element at coordinates', () => {
        // Given
        const root = el('div', {}, [])
        const child = el('button', {}, [text('Click')])
        root.insertBefore(child, null)

        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 20, height: 10 })
        layout.set(child.id, { x: 2, y: 1, width: 8, height: 3 })

        // When: hit inside child
        const target = hitTest(root, layout, 5, 2)

        // Then
        assert.equal(target, child)
    })

    it('hit test returns null outside all elements', () => {
        // Given
        const root = el('div', {}, [])
        const layout = new Map<number, LayoutBox>()
        layout.set(root.id, { x: 0, y: 0, width: 10, height: 5 })

        // When: hit outside root
        const target = hitTest(root, layout, 15, 8)

        // Then
        assert.equal(target, null)
    })

    it('event handler receives data payload', () => {
        // Given
        const node = el('div', {}, [])
        let receivedData: any = null
        node.listeners.set('keydown', new Set([(e: any) => { receivedData = e.data }]))

        // When
        dispatchEvent(node, 'keydown', { key: 'a', ctrl: false })

        // Then
        assert.deepEqual(receivedData, { key: 'a', ctrl: false })
    })
})
