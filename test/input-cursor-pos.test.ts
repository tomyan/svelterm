import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

interface Setup {
    root: TermNode
    input: TermNode
    render: () => CellBuffer
}

function setupInput(opts: {
    width: number
    height: number
    css: string
    value: string
    cursor: number
    focused: boolean
}): Setup {
    const root = new TermNode('element', 'root')
    const input = new TermNode('element', 'input')
    input.attributes.set('value', opts.value)
    input.textBuffer = new TextBuffer(opts.value)
    input.textBuffer.cursor = opts.cursor
    if (opts.focused) input.attributes.set('data-focused', 'true')
    root.insertBefore(input, null)
    const stylesheet = parseCSS(opts.css)
    const render = (): CellBuffer => {
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, opts.width, opts.height)
        const buffer = new CellBuffer(opts.width, opts.height)
        paint(root, buffer, styles, layout)
        return buffer
    }
    return { root, input, render }
}

describe('paintInput cursor position', () => {

    it('focused input populates getCursorScreenPos at the text-cursor cell', () => {
        // Given — input at (0,0), width 10, value "abc", cursor at end (3)
        const { input, render } = setupInput({
            width: 20, height: 5,
            css: 'input { width: 10cell; height: 1cell; }',
            value: 'abc', cursor: 3, focused: true,
        })

        // When
        render()

        // Then — cursor at content x=3 (no padding, no border), y=0
        const pos = input.getCursorScreenPos()
        assert.deepEqual(pos, { x: 3, y: 0, inViewport: true })
    })

    it('cursor in middle of text reports correct screen x', () => {
        // Given
        const { input, render } = setupInput({
            width: 20, height: 5,
            css: 'input { width: 10cell; height: 1cell; }',
            value: 'hello world', cursor: 5, focused: true,
        })

        // When
        render()

        // Then
        const pos = input.getCursorScreenPos()
        assert.equal(pos?.x, 5)
        assert.equal(pos?.inViewport, true)
    })

    it('unfocused input does not populate getCursorScreenPos', () => {
        // Given
        const { input, render } = setupInput({
            width: 20, height: 5,
            css: 'input { width: 10cell; height: 1cell; }',
            value: 'abc', cursor: 3, focused: false,
        })

        // When
        render()

        // Then
        assert.equal(input.getCursorScreenPos(), null)
    })

    it('focused input clipped by ancestor scroll has inViewport: false', () => {
        // Given — input row scrolled out of a fixed-height container with overflow:hidden
        const root = new TermNode('element', 'root')
        const container = new TermNode('element', 'div')
        const input = new TermNode('element', 'input')
        input.attributes.set('value', 'abc')
        input.textBuffer = new TextBuffer('abc')
        input.textBuffer.cursor = 3
        input.attributes.set('data-focused', 'true')
        container.insertBefore(input, null)
        root.insertBefore(container, null)
        // Container is 1 row tall and overflow:hidden, scrolled past the input
        const css = `
            div { width: 20cell; height: 1cell; overflow: hidden; }
            input { width: 10cell; height: 1cell; }
        `
        container.scrollTop = 5
        const stylesheet = parseCSS(css)
        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 20, 10)
        const buffer = new CellBuffer(20, 10)

        // When
        paint(root, buffer, styles, layout)

        // Then
        const pos = input.getCursorScreenPos()
        assert.ok(pos, 'cursor position is set')
        assert.equal(pos!.inViewport, false, 'cursor row falls outside ancestor clip')
    })

    it('honours scroll offset for cursors past the input width', () => {
        // Given — value longer than input width, cursor at end → input scrolls so
        // cursor sits at the rightmost content cell
        const { input, render } = setupInput({
            width: 30, height: 5,
            // 5cell content (no border, no padding)
            css: 'input { width: 5cell; height: 1cell; }',
            value: '0123456789', cursor: 10, focused: true,
        })

        // When
        render()

        // Then — cursor renders at content x=5 (one past the visible cells, in the rightmost slot)
        const pos = input.getCursorScreenPos()
        assert.equal(pos?.x, 5)
        assert.equal(pos?.inViewport, true)
    })
})
