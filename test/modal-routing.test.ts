import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { FocusManager } from '../src/input/focus.js'
import { activeModal } from '../src/input/modal.js'

function tree() {
    const root = new TermNode('element', 'root')
    const outerButton = new TermNode('element', 'button')
    const dialog = new TermNode('element', 'dialog')
    const dialogInput = new TermNode('element', 'input')
    const dialogButton = new TermNode('element', 'button')
    root.insertBefore(outerButton, null)
    root.insertBefore(dialog, null)
    dialog.insertBefore(dialogInput, null)
    dialog.insertBefore(dialogButton, null)
    return { root, outerButton, dialog, dialogInput, dialogButton }
}

describe('activeModal', () => {

    it('returns null when no dialog is open', () => {
        const { root } = tree()
        assert.equal(activeModal(root), null)
    })

    it('finds an open dialog', () => {
        const { root, dialog } = tree()
        dialog.attributes.set('open', '')
        assert.equal(activeModal(root), dialog)
    })

    it('picks the last open dialog in tree order', () => {
        const { root, dialog } = tree()
        dialog.attributes.set('open', '')
        const second = new TermNode('element', 'dialog')
        second.attributes.set('open', '')
        root.insertBefore(second, null)
        assert.equal(activeModal(root), second)
    })
})

describe('FocusManager scope', () => {

    it('traps Tab cycling inside the scope subtree', () => {
        // Given
        const { outerButton, dialog, dialogInput, dialogButton } = tree()
        const fm = new FocusManager()
        fm.register(outerButton)
        fm.register(dialogInput)
        fm.register(dialogButton)

        // When
        fm.setScope(dialog)
        fm.focusNext()
        const first = fm.focused
        fm.focusNext()
        const second = fm.focused
        fm.focusNext()
        const third = fm.focused

        // Then: outerButton is never reached
        assert.equal(first, dialogInput)
        assert.equal(second, dialogButton)
        assert.equal(third, dialogInput)
    })

    it('clearing the scope restores the full ring', () => {
        // Given
        const { outerButton, dialog, dialogInput } = tree()
        const fm = new FocusManager()
        fm.register(outerButton)
        fm.register(dialogInput)
        fm.setScope(dialog)
        fm.focusNext()

        // When
        fm.setScope(null)
        fm.focusNext()

        // Then
        assert.equal(fm.focused, outerButton)
    })
})
