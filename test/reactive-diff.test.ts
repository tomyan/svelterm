import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { diffBuffers } from '../src/render/diff.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

function renderTree(root: TermNode, css: string, width: number, height: number): CellBuffer {
    const stylesheet = parseCSS(css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('reactive differential rendering', () => {

    it('identical renders produce empty diff', () => {
        // Given
        const root = new TermNode('element', 'div')
        const text = new TermNode('text', 'Hello')
        root.insertBefore(text, null)

        // When
        const buf1 = renderTree(root, '', 20, 3)
        const buf2 = renderTree(root, '', 20, 3)

        // Then
        assert.equal(diffBuffers(buf1, buf2), '')
    })

    it('changing text content produces diff with only changed characters', () => {
        // Given
        const root = new TermNode('element', 'div')
        const text = new TermNode('text', 'Count: 0')
        root.insertBefore(text, null)

        const buf1 = renderTree(root, '', 20, 3)

        // When — simulate reactive update
        text.text = 'Count: 1'
        const buf2 = renderTree(root, '', 20, 3)

        // Then — only the '1' should be in the diff (position 7)
        const diff = diffBuffers(buf1, buf2)
        const content = diff.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
        assert.equal(content, '1')
    })

    it('changing text from single to double digit produces minimal diff', () => {
        // Given
        const root = new TermNode('element', 'div')
        const text = new TermNode('text', 'Count: 9')
        root.insertBefore(text, null)

        const buf1 = renderTree(root, '', 20, 3)

        // When
        text.text = 'Count: 10'
        const buf2 = renderTree(root, '', 20, 3)

        // Then — '1' at pos 7 and '0' at pos 8 changed
        const diff = diffBuffers(buf1, buf2)
        const content = diff.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
        assert.equal(content, '10')
    })

    it('color change with same text produces diff', () => {
        // Given
        const root = new TermNode('element', 'div')
        const span = new TermNode('element', 'span')
        span.attributes.set('class', 'txt')
        const text = new TermNode('text', 'Hi')
        span.insertBefore(text, null)
        root.insertBefore(span, null)

        const buf1 = renderTree(root, '.txt{color:red}', 20, 3)

        // When — same tree but different CSS
        const buf2 = renderTree(root, '.txt{color:blue}', 20, 3)

        // Then — characters same but style changed
        const diff = diffBuffers(buf1, buf2)
        assert.ok(diff.length > 0, 'style change produces non-empty diff')
        const content = diff.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, '')
        assert.equal(content, 'Hi')
    })
})
