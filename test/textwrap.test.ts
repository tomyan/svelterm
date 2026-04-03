import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { wrapText } from '../src/layout/text.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

describe('wrapText', () => {

    it('text shorter than width is unchanged', () => {
        const lines = wrapText('Hello', 20)
        assert.deepEqual(lines, ['Hello'])
    })

    it('wraps at word boundary when text exceeds width', () => {
        const lines = wrapText('Hello World', 7)
        assert.deepEqual(lines, ['Hello', 'World'])
    })

    it('wraps multiple words across lines', () => {
        const lines = wrapText('The quick brown fox', 10)
        assert.deepEqual(lines, ['The quick', 'brown fox'])
    })

    it('breaks long word that exceeds width', () => {
        const lines = wrapText('Supercalifragilistic', 10)
        assert.deepEqual(lines, ['Supercalif', 'ragilistic'])
    })

    it('handles empty string', () => {
        const lines = wrapText('', 10)
        assert.deepEqual(lines, [''])
    })

    it('handles single character', () => {
        const lines = wrapText('X', 5)
        assert.deepEqual(lines, ['X'])
    })

    it('handles width of 1', () => {
        const lines = wrapText('Hi', 1)
        assert.deepEqual(lines, ['H', 'i'])
    })

    it('preserves multiple spaces between words', () => {
        const lines = wrapText('A  B', 10)
        assert.deepEqual(lines, ['A  B'])
    })

    it('wraps at exactly the width boundary', () => {
        const lines = wrapText('12345 67890', 5)
        assert.deepEqual(lines, ['12345', '67890'])
    })
})

describe('text wrapping in layout + paint', () => {

    it('long text wraps inside narrow container', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('.box{width:10px}')
        const box = new TermNode('element', 'div')
        box.attributes.set('class', 'box')
        const text = new TermNode('text', 'Hello World')
        box.insertBefore(text, null)
        root.insertBefore(box, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 10)
        const buffer = new CellBuffer(40, 10)
        paint(root, buffer, styles, layout)

        // "Hello" on row 0, "World" on row 1
        assert.equal(buffer.getCell(0, 0)?.char, 'H')
        assert.equal(buffer.getCell(4, 0)?.char, 'o')
        assert.equal(buffer.getCell(0, 1)?.char, 'W')
        assert.equal(buffer.getCell(4, 1)?.char, 'd')
    })

    it('wrapped text increases container height', () => {
        const root = new TermNode('element', 'root')
        const stylesheet = parseCSS('.box{width:5px;background-color:blue}')
        const box = new TermNode('element', 'div')
        box.attributes.set('class', 'box')
        const text = new TermNode('text', 'Hello World')
        box.insertBefore(text, null)
        root.insertBefore(box, null)

        const styles = resolveStyles(root, stylesheet)
        const layout = computeLayout(root, styles, 40, 10)

        const boxLayout = layout.get(box.id)!
        assert.equal(boxLayout.height, 2) // two lines of wrapped text
    })
})
