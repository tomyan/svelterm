import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { InputDomain } from '../src/debug/input.js'
import { parseKeyEvent } from '../src/input/keyboard.js'
import { parseMouseEvent } from '../src/input/mouse.js'

function recordingDomain() {
    const keys: Buffer[] = []
    const mice: Buffer[] = []
    const pastes: string[] = []
    const domain = new InputDomain({
        key: data => { keys.push(Buffer.from(data)) },
        mouse: data => { mice.push(Buffer.from(data)) },
        paste: text => { pastes.push(text) },
    })
    return { domain, keys, mice, pastes }
}

describe('InputDomain', () => {

    it('key injects bytes that parse back to the chord', () => {
        // Given
        const { domain, keys } = recordingDomain()

        // When
        domain.handle('key', { key: 'w', ctrl: true })

        // Then
        assert.equal(keys.length, 1)
        assert.deepEqual(parseKeyEvent(keys[0]),
            { key: 'w', ctrl: true, shift: false, meta: false })
    })

    it('text injects one key per character', () => {
        const { domain, keys } = recordingDomain()
        domain.handle('text', { text: 'hi' })
        assert.equal(keys.length, 2)
        assert.equal(parseKeyEvent(keys[0])?.key, 'h')
        assert.equal(parseKeyEvent(keys[1])?.key, 'i')
    })

    it('mouse injects an SGR event at the given cell', () => {
        const { domain, mice } = recordingDomain()
        domain.handle('mouse', { type: 'press', x: 4, y: 6 })
        assert.deepEqual(parseMouseEvent(mice[0]),
            { button: 'left', type: 'press', col: 4, row: 6 })
    })

    it('paste hands the text straight to the paste hook', () => {
        const { domain, pastes } = recordingDomain()
        domain.handle('paste', { text: 'clip content' })
        assert.deepEqual(pastes, ['clip content'])
    })

    it('throws on unknown methods', () => {
        const { domain } = recordingDomain()
        assert.throws(() => domain.handle('nope', {}), /nope/)
    })

    it('throws on missing params', () => {
        const { domain } = recordingDomain()
        assert.throws(() => domain.handle('key', {}))
        assert.throws(() => domain.handle('text', {}))
    })
})
