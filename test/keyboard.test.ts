import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseKeyEvent, type KeyEvent } from '../src/input/keyboard.js'

describe('parseKeyEvent', () => {

    describe('regular characters', () => {
        it('parses "a"', () => {
            const key = parseKeyEvent(Buffer.from('a'))
            assert.equal(key?.key, 'a')
            assert.equal(key?.ctrl, false)
        })

        it('parses "Z"', () => {
            const key = parseKeyEvent(Buffer.from('Z'))
            assert.equal(key?.key, 'Z')
        })

        it('parses space', () => {
            const key = parseKeyEvent(Buffer.from(' '))
            assert.equal(key?.key, ' ')
        })

        it('parses "1"', () => {
            const key = parseKeyEvent(Buffer.from('1'))
            assert.equal(key?.key, '1')
        })
    })

    describe('special keys', () => {
        it('parses Enter (0x0d)', () => {
            const key = parseKeyEvent(Buffer.from([0x0d]))
            assert.equal(key?.key, 'Enter')
        })

        it('parses Escape (0x1b alone)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b]))
            assert.equal(key?.key, 'Escape')
        })

        it('parses Tab (0x09)', () => {
            const key = parseKeyEvent(Buffer.from([0x09]))
            assert.equal(key?.key, 'Tab')
        })

        it('parses Backspace (0x7f)', () => {
            const key = parseKeyEvent(Buffer.from([0x7f]))
            assert.equal(key?.key, 'Backspace')
        })
    })

    describe('Ctrl+key', () => {
        it('parses Ctrl+C (0x03)', () => {
            const key = parseKeyEvent(Buffer.from([0x03]))
            assert.equal(key?.key, 'c')
            assert.equal(key?.ctrl, true)
        })

        it('parses Ctrl+A (0x01)', () => {
            const key = parseKeyEvent(Buffer.from([0x01]))
            assert.equal(key?.key, 'a')
            assert.equal(key?.ctrl, true)
        })

        it('parses Ctrl+Z (0x1a)', () => {
            const key = parseKeyEvent(Buffer.from([0x1a]))
            assert.equal(key?.key, 'z')
            assert.equal(key?.ctrl, true)
        })
    })

    describe('arrow keys', () => {
        it('parses Up arrow (ESC[A)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x41]))
            assert.equal(key?.key, 'ArrowUp')
        })

        it('parses Down arrow (ESC[B)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x42]))
            assert.equal(key?.key, 'ArrowDown')
        })

        it('parses Right arrow (ESC[C)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x43]))
            assert.equal(key?.key, 'ArrowRight')
        })

        it('parses Left arrow (ESC[D)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x44]))
            assert.equal(key?.key, 'ArrowLeft')
        })
    })

    describe('extended keys', () => {
        it('parses Home (ESC[H)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x48]))
            assert.equal(key?.key, 'Home')
        })

        it('parses End (ESC[F)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x46]))
            assert.equal(key?.key, 'End')
        })

        it('parses Delete (ESC[3~)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x33, 0x7e]))
            assert.equal(key?.key, 'Delete')
        })

        it('parses PageUp (ESC[5~)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x35, 0x7e]))
            assert.equal(key?.key, 'PageUp')
        })

        it('parses PageDown (ESC[6~)', () => {
            const key = parseKeyEvent(Buffer.from([0x1b, 0x5b, 0x36, 0x7e]))
            assert.equal(key?.key, 'PageDown')
        })
    })

    describe('edge cases', () => {
        it('returns null for empty buffer', () => {
            const key = parseKeyEvent(Buffer.from([]))
            assert.equal(key, null)
        })
    })
})
