import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function renderInput(opts: {
    value: string
    select?: { anchor: number; cursor: number }
    focused?: boolean
    width?: number
}): CellBuffer {
    const fieldWidth = opts.width ?? 20
    const root = new TermNode('element', 'root')
    const input = new TermNode('element', 'input')
    input.attributes.set('value', opts.value)
    input.textBuffer = new TextBuffer(opts.value)
    if (opts.select) {
        input.textBuffer.cursor = opts.select.anchor
        input.textBuffer.beginExtend()
        input.textBuffer.cursor = opts.select.cursor
    }
    if (opts.focused !== false) input.attributes.set('data-focused', 'true')
    root.insertBefore(input, null)
    const styles = resolveStyles(root, parseCSS(`input { width: ${fieldWidth}cell; height: 1cell; }`))
    const layout = computeLayout(root, styles, 30, 5)
    const buffer = new CellBuffer(30, 5)
    paint(root, buffer, styles, layout)
    return buffer
}

function inverseCols(buffer: CellBuffer, row = 0): number[] {
    const cols: number[] = []
    for (let col = 0; col < 30; col++) {
        if (buffer.getCell(col, row)?.inverse) cols.push(col)
    }
    return cols
}

describe('input selection painting', () => {

    it('paints the selected span inverted', () => {
        // Given
        const buffer = renderInput({ value: 'hello world', select: { anchor: 6, cursor: 11 } })

        // Then
        assert.deepEqual(inverseCols(buffer), [6, 7, 8, 9, 10])
    })

    it('paints nothing without a selection', () => {
        const buffer = renderInput({ value: 'hello world' })
        assert.deepEqual(inverseCols(buffer), [])
    })

    it('paints nothing when the input is not focused', () => {
        const buffer = renderInput({ value: 'hello world', select: { anchor: 0, cursor: 5 }, focused: false })
        assert.deepEqual(inverseCols(buffer), [])
    })

    it('clips the highlight to the visible scrolled window', () => {
        // Given — field of 5 cells, cursor at the end keeps the tail visible
        const buffer = renderInput({
            value: 'abcdefghij', width: 5,
            select: { anchor: 7, cursor: 10 },
        })

        // Then — offsets 7..10 of "fghij" (scrolled by 5) are columns 2..4
        assert.deepEqual(inverseCols(buffer), [2, 3, 4])
    })
})
