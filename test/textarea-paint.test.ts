import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

interface Setup {
    textarea: TermNode
    buffer: CellBuffer
    render: () => CellBuffer
}

function setupTextarea(opts: {
    value: string
    cursor?: number
    select?: { anchor: number; cursor: number }
    focused?: boolean
    css?: string
}): Setup {
    const root = new TermNode('element', 'root')
    const textarea = new TermNode('element', 'textarea')
    textarea.insertBefore(new TermNode('text', opts.value), null)
    textarea.textBuffer = new TextBuffer(opts.value)
    textarea.textBuffer.multiline = true
    if (opts.select) {
        textarea.textBuffer.cursor = opts.select.anchor
        textarea.textBuffer.beginExtend()
        textarea.textBuffer.cursor = opts.select.cursor
    } else {
        textarea.textBuffer.cursor = opts.cursor ?? opts.value.length
    }
    if (opts.focused !== false) textarea.attributes.set('data-focused', 'true')
    root.insertBefore(textarea, null)
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + (opts.css ?? 'textarea { width: 10cell; height: 3cell; }'))
    const buffer = new CellBuffer(20, 8)
    const render = (): CellBuffer => {
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 8)
        paint(root, buffer, styles, layout)
        return buffer
    }
    return { textarea, buffer, render }
}

function rowText(buffer: CellBuffer, y: number, width = 10): string {
    let out = ''
    for (let x = 0; x < width; x++) out += buffer.getCell(x, y)?.char ?? ' '
    return out.trimEnd()
}

describe('textarea rendering', () => {

    it('newlines render as separate rows (UA white-space: pre)', () => {
        // Given
        const { buffer, render } = setupTextarea({ value: 'ab\ncd', focused: false })

        // When
        render()

        // Then
        assert.equal(rowText(buffer, 0), 'ab')
        assert.equal(rowText(buffer, 1), 'cd')
    })

    it('a focused textarea publishes the cursor at its line and column', () => {
        // Given — cursor after "cd" on line 1
        const { textarea, render } = setupTextarea({ value: 'ab\ncdef', cursor: 5 })

        // When
        render()

        // Then
        const pos = textarea.getCursorScreenPos()
        assert.equal(pos?.x, 2)
        assert.equal(pos?.y, 1)
        assert.equal(pos?.inViewport, true)
    })

    it('scroll follows the cursor below the viewport', () => {
        // Given — 8 lines in a 3-row textarea, cursor on the last line
        const value = Array.from({ length: 8 }, (_, i) => `line-${i}`).join('\n')
        const { textarea, buffer, render } = setupTextarea({ value })

        // When
        render()

        // Then — the last line is visible and carries the cursor
        assert.equal(textarea.scrollTop, 5)
        assert.equal(rowText(buffer, 2), 'line-7')
        const pos = textarea.getCursorScreenPos()
        assert.equal(pos?.y, 2)
        assert.equal(pos?.inViewport, true)
    })

    it('scroll follows the cursor back up', () => {
        const value = Array.from({ length: 8 }, (_, i) => `line-${i}`).join('\n')
        const { textarea, render } = setupTextarea({ value })
        render()
        assert.equal(textarea.scrollTop, 5)

        // When — cursor moves to the first line
        textarea.textBuffer!.cursor = 0
        render()

        // Then
        assert.equal(textarea.scrollTop, 0)
        assert.equal(textarea.getCursorScreenPos()?.y, 0)
    })

    it('paints a line-spanning selection inverted', () => {
        // Given — "ab\ncd", selection [1, 4): "b\nc"
        const { buffer, render } = setupTextarea({
            value: 'ab\ncd',
            select: { anchor: 1, cursor: 4 },
        })

        // When
        render()

        // Then — 'b' on row 0 and 'c' on row 1 invert; neighbours don't
        assert.equal(buffer.getCell(1, 0)?.inverse, true)
        assert.equal(buffer.getCell(0, 0)?.inverse, false)
        assert.equal(buffer.getCell(0, 1)?.inverse, true)
        assert.equal(buffer.getCell(1, 1)?.inverse, false)
    })

    it('paints no cursor or selection when unfocused', () => {
        const { textarea, buffer, render } = setupTextarea({
            value: 'ab\ncd',
            select: { anchor: 1, cursor: 4 },
            focused: false,
        })
        render()
        assert.equal(textarea.getCursorScreenPos(), null)
        assert.equal(buffer.getCell(1, 0)?.inverse, false)
    })
})
