import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SelectionController, applySelectionOverlay } from '../src/input/selection.js'
import { CellBuffer } from '../src/render/buffer.js'

function bufferWith(rows: string[]): CellBuffer {
    const buffer = new CellBuffer(20, rows.length)
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            buffer.setCell(x, y, { char: row[x] })
        }
    })
    return buffer
}

function makeController(rows: string[], now = () => 0) {
    const buffer = bufferWith(rows)
    return { controller: new SelectionController(() => buffer, now), buffer }
}

describe('drag selection', () => {

    it('is inactive until the pointer moves off the press cell', () => {
        // Given
        const { controller } = makeController(['hello world'])

        // When
        controller.onPress(2, 0)

        // Then
        assert.equal(controller.range(), null)
    })

    it('selects the row-major range between anchor and point', () => {
        // Given
        const { controller } = makeController(['hello world', 'second line'])

        // When
        controller.onPress(2, 0)
        controller.onMotion(4, 1)

        // Then
        const range = controller.range()
        assert.deepEqual(range, { start: { col: 2, row: 0 }, end: { col: 4, row: 1 } })
    })

    it('normalises an upward drag so start comes first', () => {
        // Given
        const { controller } = makeController(['hello world', 'second line'])

        // When
        controller.onPress(4, 1)
        controller.onMotion(2, 0)

        // Then
        assert.deepEqual(controller.range(),
            { start: { col: 2, row: 0 }, end: { col: 4, row: 1 } })
    })

    it('release returns the selected text and keeps the selection visible', () => {
        // Given
        const { controller } = makeController(['hello world'])
        controller.onPress(0, 0)
        controller.onMotion(4, 0)

        // When
        const text = controller.onRelease()

        // Then
        assert.equal(text, 'hello')
        assert.notEqual(controller.range(), null)
    })

    it('selecting across rows joins lines and trims trailing blanks', () => {
        // Given
        const { controller } = makeController(['hello', 'world'])
        controller.onPress(0, 0)
        controller.onMotion(4, 1)

        // When
        const text = controller.onRelease()

        // Then
        assert.equal(text, 'hello\nworld')
    })

    it('a plain click clears the previous selection', () => {
        // Given
        const { controller } = makeController(['hello world'])
        controller.onPress(0, 0)
        controller.onMotion(4, 0)
        controller.onRelease()

        // When: a fresh press-release with no movement
        controller.onPress(8, 0)
        const text = controller.onRelease()

        // Then
        assert.equal(text, null)
        assert.equal(controller.range(), null)
    })
})

describe('double and triple click', () => {

    it('double-click selects the word under the pointer', () => {
        // Given
        let time = 0
        const { controller } = makeController(['hello world'], () => time)

        // When
        controller.onPress(7, 0); controller.onRelease()
        time = 200
        controller.onPress(7, 0)

        // Then
        assert.deepEqual(controller.range(),
            { start: { col: 6, row: 0 }, end: { col: 10, row: 0 } })
        assert.equal(controller.onRelease(), 'world')
    })

    it('triple-click selects the whole line', () => {
        // Given
        let time = 0
        const { controller } = makeController(['hello world  '], () => time)

        // When
        controller.onPress(7, 0); controller.onRelease()
        time = 150
        controller.onPress(7, 0); controller.onRelease()
        time = 300
        controller.onPress(7, 0)

        // Then
        assert.equal(controller.onRelease(), 'hello world')
    })

    it('slow clicks do not count as double', () => {
        // Given
        let time = 0
        const { controller } = makeController(['hello world'], () => time)

        // When
        controller.onPress(7, 0); controller.onRelease()
        time = 900
        controller.onPress(7, 0)

        // Then
        assert.equal(controller.range(), null)
    })
})

describe('applySelectionOverlay', () => {

    it('inverts cells inside the range', () => {
        // Given
        const buffer = bufferWith(['hello world'])

        // When
        applySelectionOverlay(buffer, { start: { col: 1, row: 0 }, end: { col: 3, row: 0 } })

        // Then
        assert.equal(buffer.getCell(0, 0)?.inverse, false)
        assert.equal(buffer.getCell(1, 0)?.inverse, true)
        assert.equal(buffer.getCell(3, 0)?.inverse, true)
        assert.equal(buffer.getCell(4, 0)?.inverse, false)
    })

    it('spans full middle rows on multi-row ranges', () => {
        // Given
        const buffer = bufferWith(['aaaa', 'bbbb', 'cccc'])

        // When
        applySelectionOverlay(buffer, { start: { col: 2, row: 0 }, end: { col: 1, row: 2 } })

        // Then
        assert.equal(buffer.getCell(1, 0)?.inverse, false)
        assert.equal(buffer.getCell(2, 0)?.inverse, true)
        assert.equal(buffer.getCell(0, 1)?.inverse, true)
        assert.equal(buffer.getCell(3, 1)?.inverse, true)
        assert.equal(buffer.getCell(1, 2)?.inverse, true)
        assert.equal(buffer.getCell(2, 2)?.inverse, false)
    })
})
