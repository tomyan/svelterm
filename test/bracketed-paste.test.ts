import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parsePaste } from '../src/input/keyboard.js'

describe('bracketed paste', () => {

    it('detects paste sequence and extracts content', () => {
        const data = Buffer.from('\x1b[200~Hello World\x1b[201~')
        const result = parsePaste(data)
        assert.equal(result, 'Hello World')
    })

    it('handles paste without end marker', () => {
        const data = Buffer.from('\x1b[200~partial paste')
        const result = parsePaste(data)
        assert.equal(result, 'partial paste')
    })

    it('returns null for non-paste data', () => {
        const data = Buffer.from('hello')
        assert.equal(parsePaste(data), null)
    })

    it('handles empty paste', () => {
        const data = Buffer.from('\x1b[200~\x1b[201~')
        assert.equal(parsePaste(data), '')
    })

    it('preserves newlines in pasted content', () => {
        const data = Buffer.from('\x1b[200~line1\nline2\nline3\x1b[201~')
        const result = parsePaste(data)
        assert.equal(result, 'line1\nline2\nline3')
    })
})
