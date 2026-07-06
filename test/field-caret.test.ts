import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { TextBuffer } from '../src/components/text-buffer.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout, type LayoutBox } from '../src/layout/engine.js'
import { caretOffsetForClick, ClickCounter } from '../src/input/field-caret.js'

function setupInput(css: string, value: string): { input: TermNode; box: LayoutBox } {
    const root = new TermNode('element', 'root')
    const input = new TermNode('element', 'input')
    input.attributes.set('value', value)
    input.textBuffer = new TextBuffer(value)
    root.insertBefore(input, null)
    const styles = resolveStyles(root, parseCSS(css))
    const layout = computeLayout(root, styles, 40, 5)
    return { input, box: layout.get(input.id)! }
}

describe('caretOffsetForClick', () => {

    it('maps a column inside the text to its offset', () => {
        // Given
        const { input, box } = setupInput('input { width: 20cell; height: 1cell; }', 'hello world')

        // When / Then
        assert.equal(caretOffsetForClick(input, box, 3), 3)
    })

    it('clamps a click past the end of the text to its length', () => {
        const { input, box } = setupInput('input { width: 20cell; height: 1cell; }', 'hi')
        assert.equal(caretOffsetForClick(input, box, 15), 2)
    })

    it('accounts for border and padding insets', () => {
        // Given — content starts at border (1) + padding-left (2) = column 3
        const { input, box } = setupInput(
            'input { width: 20cell; height: 3cell; border: single; padding-left: 2cell; }',
            'hello',
        )

        // When / Then
        assert.equal(caretOffsetForClick(input, box, 3), 0)
        assert.equal(caretOffsetForClick(input, box, 5), 2)
    })

    it('clicking the border lands at offset 0', () => {
        const { input, box } = setupInput(
            'input { width: 20cell; height: 3cell; border: single; }',
            'hello',
        )
        assert.equal(caretOffsetForClick(input, box, 0), 0)
    })

    it('adds the horizontal scroll offset', () => {
        const { input, box } = setupInput('input { width: 10cell; height: 1cell; }', 'a long scrolled value')
        input.scrollLeft = 4
        assert.equal(caretOffsetForClick(input, box, 2), 6)
    })
})

describe('ClickCounter', () => {

    it('counts a quick second click on the same cell of the same node', () => {
        // Given
        const clicks = new ClickCounter()

        // When / Then
        assert.equal(clicks.click(1, 5, 2, 1000), 1)
        assert.equal(clicks.click(1, 5, 2, 1200), 2)
    })

    it('a third quick click counts three', () => {
        const clicks = new ClickCounter()
        clicks.click(1, 5, 2, 1000)
        clicks.click(1, 5, 2, 1200)
        assert.equal(clicks.click(1, 5, 2, 1400), 3)
    })

    it('resets on a different cell', () => {
        const clicks = new ClickCounter()
        clicks.click(1, 5, 2, 1000)
        assert.equal(clicks.click(1, 6, 2, 1100), 1)
    })

    it('resets on a different node', () => {
        const clicks = new ClickCounter()
        clicks.click(1, 5, 2, 1000)
        assert.equal(clicks.click(2, 5, 2, 1100), 1)
    })

    it('resets when the second click is slow', () => {
        const clicks = new ClickCounter()
        clicks.click(1, 5, 2, 1000)
        assert.equal(clicks.click(1, 5, 2, 2000), 1)
    })
})
