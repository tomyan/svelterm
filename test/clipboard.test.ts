import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { osc52Copy } from '../src/terminal/clipboard.js'

describe('osc52Copy', () => {

    it('encodes the text as base64 in an OSC 52 sequence', () => {
        // When
        const seq = osc52Copy('hello')

        // Then
        assert.equal(seq, `\x1b]52;c;${Buffer.from('hello').toString('base64')}\x07`)
    })

    it('handles multi-byte characters', () => {
        const seq = osc52Copy('héllo ✓')
        const b64 = seq.slice('\x1b]52;c;'.length, -1)
        assert.equal(Buffer.from(b64, 'base64').toString('utf8'), 'héllo ✓')
    })
})
