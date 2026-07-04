import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseKeyEvent } from '../src/input/keyboard.js'

const seq = (s: string) => Buffer.from(s)

describe('kitty keyboard protocol (CSI u)', () => {

    it('parses a plain printable key', () => {
        assert.deepEqual(parseKeyEvent(seq('\x1b[97u')),
            { key: 'a', ctrl: false, shift: false, meta: false })
    })

    it('parses ctrl+letter', () => {
        assert.deepEqual(parseKeyEvent(seq('\x1b[99;5u')),
            { key: 'c', ctrl: true, shift: false, meta: false })
    })

    it('parses shift and alt modifiers', () => {
        assert.deepEqual(parseKeyEvent(seq('\x1b[97;2u')),
            { key: 'a', ctrl: false, shift: true, meta: false })
        assert.deepEqual(parseKeyEvent(seq('\x1b[97;3u')),
            { key: 'a', ctrl: false, shift: false, meta: true })
    })

    it('parses functional keys by codepoint', () => {
        assert.equal(parseKeyEvent(seq('\x1b[13u'))?.key, 'Enter')
        assert.equal(parseKeyEvent(seq('\x1b[27u'))?.key, 'Escape')
        assert.equal(parseKeyEvent(seq('\x1b[9u'))?.key, 'Tab')
        assert.equal(parseKeyEvent(seq('\x1b[127u'))?.key, 'Backspace')
    })

    it('parses ctrl+Enter, which legacy encoding cannot express', () => {
        assert.deepEqual(parseKeyEvent(seq('\x1b[13;5u')),
            { key: 'Enter', ctrl: true, shift: false, meta: false })
    })
})
