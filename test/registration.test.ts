import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { FocusManager } from '../src/input/focus.js'

describe('focusable node registration', () => {

    it('does not duplicate when registered twice', () => {
        const fm = new FocusManager()
        const btn = new TermNode('element', 'button')
        fm.register(btn)
        fm.register(btn) // duplicate
        assert.equal(fm.count, 1)
    })
})
