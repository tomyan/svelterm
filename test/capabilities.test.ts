import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    resolveColorDepth, matchXTVERSION, matchDECRQM, decrqmSupported,
} from '../src/terminal/capabilities.js'

describe('resolveColorDepth', () => {

    it('NO_COLOR wins over everything', () => {
        assert.equal(resolveColorDepth({ NO_COLOR: '1', COLORTERM: 'truecolor' }), 'mono')
    })

    it('COLORTERM truecolor/24bit means truecolor', () => {
        assert.equal(resolveColorDepth({ COLORTERM: 'truecolor' }), 'truecolor')
        assert.equal(resolveColorDepth({ COLORTERM: '24bit' }), 'truecolor')
    })

    it('known truecolor terminals detected via XTVERSION', () => {
        assert.equal(resolveColorDepth({}, 'iTerm2 3.5.9'), 'truecolor')
        assert.equal(resolveColorDepth({}, 'kitty(0.32.1)'), 'truecolor')
        assert.equal(resolveColorDepth({}, 'WezTerm 20240203'), 'truecolor')
        assert.equal(resolveColorDepth({}, 'ghostty 1.1.0'), 'truecolor')
        assert.equal(resolveColorDepth({ TERM: 'xterm-256color' }, 'tmux 3.4'), '256')
    })

    it('TERM with 256color means 256', () => {
        assert.equal(resolveColorDepth({ TERM: 'xterm-256color' }), '256')
        assert.equal(resolveColorDepth({ TERM: 'screen-256color' }), '256')
    })

    it('defaults to 16 colours', () => {
        assert.equal(resolveColorDepth({ TERM: 'xterm' }), '16')
        assert.equal(resolveColorDepth({}), '16')
    })
})

describe('terminal query matchers', () => {

    it('matches an XTVERSION reply and extracts the name', () => {
        // Given: DCS > | name ST
        const reply = '\x1bP>|iTerm2 3.5.9\x1b\\'

        // Then
        assert.equal(matchXTVERSION(reply), 'iTerm2 3.5.9')
    })

    it('returns null for unrelated input', () => {
        assert.equal(matchXTVERSION('\x1b[1;2c'), null)
    })

    it('matches a DECRQM 2026 reply', () => {
        assert.equal(matchDECRQM(2026)('\x1b[?2026;2$y'), '\x1b[?2026;2$y')
        assert.equal(matchDECRQM(2026)('junk'), null)
    })

    it('reads support from the DECRQM reply value', () => {
        // 1 = set, 2 = reset — both mean the mode is recognised
        assert.equal(decrqmSupported('\x1b[?2026;1$y'), true)
        assert.equal(decrqmSupported('\x1b[?2026;2$y'), true)
        // 0 = not recognised
        assert.equal(decrqmSupported('\x1b[?2026;0$y'), false)
        assert.equal(decrqmSupported(null), false)
    })
})
