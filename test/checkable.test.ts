import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isCheckableInput, toggleCheckable } from '../src/input/checkable.js'
import { TermNode } from '../src/renderer/node.js'

function makeInput(type: string, attrs?: Record<string, string>): TermNode {
    const node = new TermNode('element', 'input')
    node.attributes.set('type', type)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    return node
}

describe('checkable inputs', () => {

    describe('isCheckableInput', () => {
        it('recognises checkbox and radio inputs only', () => {
            assert.equal(isCheckableInput(makeInput('checkbox')), true)
            assert.equal(isCheckableInput(makeInput('radio')), true)
            assert.equal(isCheckableInput(makeInput('text')), false)
            assert.equal(isCheckableInput(new TermNode('element', 'button')), false)
        })
    })

    describe('checkbox toggling', () => {
        it('checks an unchecked checkbox and unchecks a checked one', () => {
            // Given
            const box = makeInput('checkbox')

            // When / Then
            toggleCheckable(box)
            assert.equal(box.attributes.get('checked'), 'true')
            toggleCheckable(box)
            assert.equal(box.attributes.has('checked'), false)
        })

        it('dispatches a change event with the new state', () => {
            // Given
            const box = makeInput('checkbox')
            const seen: boolean[] = []
            box.listeners.set('change', new Set([(e: any) => seen.push(e.data.checked)]))

            // When
            toggleCheckable(box)
            toggleCheckable(box)

            // Then
            assert.deepEqual(seen, [true, false])
        })

        it('includes the control value in change events, as e.target.value would', () => {
            // Given
            const radio = makeInput('radio', { value: 'team' })
            const seen: string[] = []
            radio.listeners.set('change', new Set([(e: any) => seen.push(e.data.value)]))

            // When
            toggleCheckable(radio)

            // Then
            assert.deepEqual(seen, ['team'])
            assert.equal(radio.value, 'team') // DOM-compat property
        })
    })

    describe('radio groups', () => {
        function makeGroup(): { root: TermNode; radios: TermNode[] } {
            const root = new TermNode('element', 'root')
            const radios = ['a', 'b', 'c'].map(() => makeInput('radio', { name: 'fruit' }))
            for (const radio of radios) root.insertBefore(radio, null)
            return { root, radios }
        }

        it('checking one radio unchecks the others in its group', () => {
            // Given
            const { radios } = makeGroup()
            toggleCheckable(radios[0])

            // When
            toggleCheckable(radios[1])

            // Then
            assert.equal(radios[0].attributes.has('checked'), false)
            assert.equal(radios[1].attributes.get('checked'), 'true')
        })

        it('re-selecting a checked radio leaves it checked', () => {
            // Given
            const { radios } = makeGroup()
            toggleCheckable(radios[2])

            // When
            toggleCheckable(radios[2])

            // Then
            assert.equal(radios[2].attributes.get('checked'), 'true')
        })

        it('radios with a different name are untouched', () => {
            // Given
            const { root, radios } = makeGroup()
            const other = makeInput('radio', { name: 'veg', checked: 'true' })
            root.insertBefore(other, null)

            // When
            toggleCheckable(radios[0])

            // Then
            assert.equal(other.attributes.get('checked'), 'true')
        })
    })
})
