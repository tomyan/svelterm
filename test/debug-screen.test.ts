import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ScreenDomain } from '../src/debug/screen.js'
import { CellBuffer } from '../src/render/buffer.js'

function bufferWith(text: string, width = 10, height = 3): CellBuffer {
    const buffer = new CellBuffer(width, height)
    for (let i = 0; i < text.length; i++) {
        buffer.setCell(i, 0, { char: text[i] })
    }
    return buffer
}

describe('ScreenDomain snapshots', () => {

    it('text returns the displayed buffer as plain text with dimensions', () => {
        // Given
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith('hello'),
            renderPending: () => false,
        })

        // When
        const result = domain.handle('text', {})

        // Then
        assert.match(result.text, /^hello/)
        assert.equal(result.width, 10)
        assert.equal(result.height, 3)
    })

    it('styled returns styled markup', () => {
        const buffer = bufferWith('hi')
        buffer.setCell(0, 0, { char: 'h', fg: 'green' })
        const domain = new ScreenDomain({
            displayBuffer: () => buffer,
            renderPending: () => false,
        })
        const result = domain.handle('styled', {})
        assert.ok(result.text.includes('green'))
    })

    it('cell returns a full cell record', () => {
        const buffer = bufferWith('x')
        buffer.setCell(0, 0, { char: 'x', inverse: true, bold: true })
        const domain = new ScreenDomain({
            displayBuffer: () => buffer,
            renderPending: () => false,
        })
        const cell = domain.handle('cell', { x: 0, y: 0 })
        assert.equal(cell.char, 'x')
        assert.equal(cell.inverse, true)
        assert.equal(cell.bold, true)
    })

    it('cell throws for out-of-bounds coordinates', () => {
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith('x', 5, 2),
            renderPending: () => false,
        })
        assert.throws(() => domain.handle('cell', { x: 99, y: 0 }), /bounds/)
    })

    it('throws before the first frame is painted', () => {
        const domain = new ScreenDomain({
            displayBuffer: () => null,
            renderPending: () => false,
        })
        assert.throws(() => domain.handle('text', {}), /frame/)
    })

    it('throws on unknown methods', () => {
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith(''),
            renderPending: () => false,
        })
        assert.throws(() => domain.handle('nope', {}), /nope/)
    })
})

describe('ScreenDomain settle', () => {

    it('resolves immediately when nothing is pending', async () => {
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith(''),
            renderPending: () => false,
        })
        await domain.handle('settle', {})
    })

    it('waits until pending renders drain', async () => {
        // Given — pending for the first few checks
        let checks = 0
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith(''),
            renderPending: () => ++checks < 3,
        })

        // When
        await domain.handle('settle', {})

        // Then — it polled until the pending flag cleared
        assert.ok(checks >= 3)
    })

    it('rejects on timeout while renders stay pending', async () => {
        const domain = new ScreenDomain({
            displayBuffer: () => bufferWith(''),
            renderPending: () => true,
        })
        await assert.rejects(domain.handle('settle', { timeoutMs: 50 }), /settle/)
    })
})
