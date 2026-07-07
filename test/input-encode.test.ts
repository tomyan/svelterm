import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeKey, encodeMouse } from '../src/input/encode.js'
import { parseKeyEvent, type KeyEvent } from '../src/input/keyboard.js'
import { parseMouseEvent } from '../src/input/mouse.js'

/** Encode a key spec, decode it with the real parser, return the event. */
function roundTrip(key: string, mods: Partial<KeyEvent> = {}): KeyEvent | null {
    return parseKeyEvent(Buffer.from(encodeKey({ key, ...mods }), 'binary'))
}

describe('encodeKey round-trips through parseKeyEvent', () => {

    it('plain printable characters', () => {
        assert.deepEqual(roundTrip('a'), { key: 'a', ctrl: false, shift: false, meta: false })
        assert.deepEqual(roundTrip('Z'), { key: 'Z', ctrl: false, shift: false, meta: false })
        assert.deepEqual(roundTrip(' '), { key: ' ', ctrl: false, shift: false, meta: false })
    })

    it('Ctrl+letter chords', () => {
        assert.deepEqual(roundTrip('a', { ctrl: true }), { key: 'a', ctrl: true, shift: false, meta: false })
        assert.deepEqual(roundTrip('w', { ctrl: true }), { key: 'w', ctrl: true, shift: false, meta: false })
    })

    it('Ctrl+_ (undo chord)', () => {
        assert.deepEqual(roundTrip('_', { ctrl: true }), { key: '_', ctrl: true, shift: false, meta: false })
    })

    it('Alt chords as ESC prefix', () => {
        assert.deepEqual(roundTrip('b', { meta: true }), { key: 'b', ctrl: false, shift: false, meta: true })
        assert.deepEqual(roundTrip('Backspace', { meta: true }), { key: 'Backspace', ctrl: false, shift: false, meta: true })
    })

    it('named specials', () => {
        for (const key of ['Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'Home', 'End',
            'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            assert.equal(roundTrip(key)?.key, key, key)
        }
    })

    it('Shift+Tab', () => {
        const evt = roundTrip('Tab', { shift: true })
        assert.equal(evt?.key, 'Tab')
        assert.equal(evt?.shift, true)
    })

    it('modified arrows', () => {
        assert.deepEqual(roundTrip('ArrowLeft', { ctrl: true }),
            { key: 'ArrowLeft', ctrl: true, shift: false, meta: false })
        assert.deepEqual(roundTrip('ArrowRight', { shift: true }),
            { key: 'ArrowRight', ctrl: false, shift: true, meta: false })
        assert.deepEqual(roundTrip('ArrowLeft', { ctrl: true, shift: true }),
            { key: 'ArrowLeft', ctrl: true, shift: true, meta: false })
        assert.deepEqual(roundTrip('ArrowLeft', { meta: true }),
            { key: 'ArrowLeft', ctrl: false, shift: false, meta: true })
        assert.deepEqual(roundTrip('Home', { shift: true }),
            { key: 'Home', ctrl: false, shift: true, meta: false })
    })

    it('rejects unknown key names', () => {
        assert.throws(() => encodeKey({ key: 'NoSuchKey' }), /NoSuchKey/)
    })
})

describe('encodeMouse round-trips through parseMouseEvent', () => {

    function mouseTrip(spec: Parameters<typeof encodeMouse>[0]) {
        return parseMouseEvent(Buffer.from(encodeMouse(spec), 'binary'))
    }

    it('left press at 0-based cell coordinates', () => {
        assert.deepEqual(mouseTrip({ type: 'press', x: 4, y: 6 }),
            { button: 'left', type: 'press', col: 4, row: 6 })
    })

    it('release', () => {
        assert.deepEqual(mouseTrip({ type: 'release', x: 4, y: 6 }),
            { button: 'left', type: 'release', col: 4, row: 6 })
    })

    it('right button press', () => {
        assert.deepEqual(mouseTrip({ type: 'press', x: 0, y: 0, button: 'right' }),
            { button: 'right', type: 'press', col: 0, row: 0 })
    })

    it('drag motion with left held', () => {
        assert.deepEqual(mouseTrip({ type: 'motion', x: 9, y: 2 }),
            { button: 'left', type: 'motion', col: 9, row: 2 })
    })

    it('scroll up and down', () => {
        assert.deepEqual(mouseTrip({ type: 'scroll', x: 1, y: 1, button: 'scrollUp' }),
            { button: 'scrollUp', type: 'scroll', col: 1, row: 1 })
        assert.deepEqual(mouseTrip({ type: 'scroll', x: 1, y: 1, button: 'scrollDown' }),
            { button: 'scrollDown', type: 'scroll', col: 1, row: 1 })
    })
})
