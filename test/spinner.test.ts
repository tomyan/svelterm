import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { Spinner, SPINNER_DOTS, SPINNER_LINE, SPINNER_BRAILLE } from '../src/components/spinner.js'

describe('Spinner', () => {

    it('starts at frame 0', () => {
        const s = new Spinner(SPINNER_DOTS)
        assert.equal(s.frame, '⠋')
    })

    it('advances to next frame', () => {
        const s = new Spinner(SPINNER_DOTS)
        s.tick()
        assert.equal(s.frame, '⠙')
    })

    it('wraps around to first frame', () => {
        const s = new Spinner(['A', 'B', 'C'])
        s.tick() // B
        s.tick() // C
        s.tick() // A (wrapped)
        assert.equal(s.frame, 'A')
    })

    it('reset returns to frame 0', () => {
        const s = new Spinner(['A', 'B', 'C'])
        s.tick()
        s.tick()
        s.reset()
        assert.equal(s.frame, 'A')
    })

    it('SPINNER_DOTS has 10 frames', () => {
        assert.equal(SPINNER_DOTS.length, 10)
    })

    it('SPINNER_LINE has frames', () => {
        assert.ok(SPINNER_LINE.length > 0)
    })

    it('SPINNER_BRAILLE has frames', () => {
        assert.ok(SPINNER_BRAILLE.length > 0)
    })
})
