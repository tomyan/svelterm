import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

describe('inline style attribute', () => {

    it('applies background-color from style attribute', () => {
        // Given
        const root = new TermNode('element', 'root')
        const node = new TermNode('element', 'div')
        node.attributes.set('style', 'background-color: #abcdef')
        root.insertBefore(node, null)

        // When
        const styles = resolveStyles(root, parseCSS(''))

        // Then
        assert.equal(styles.get(node.id)?.bg, '#abcdef')
    })

    it('applies multiple declarations separated by semicolons', () => {
        // Given
        const root = new TermNode('element', 'root')
        const node = new TermNode('element', 'div')
        node.attributes.set('style', 'color: blue; background-color: yellow; font-weight: bold')
        root.insertBefore(node, null)

        // When
        const styles = resolveStyles(root, parseCSS(''))

        // Then
        const s = styles.get(node.id)!
        assert.equal(s.fg, 'blue')
        assert.equal(s.bg, 'yellow')
        assert.equal(s.bold, true)
    })

    it('inline style overrides stylesheet rules', () => {
        // Given
        const root = new TermNode('element', 'root')
        const node = new TermNode('element', 'div')
        node.attributes.set('class', 'box')
        node.attributes.set('style', 'background-color: green')
        root.insertBefore(node, null)

        // When
        const styles = resolveStyles(root, parseCSS('.box { background-color: red }'))

        // Then
        assert.equal(styles.get(node.id)?.bg, 'green')
    })

    it('ignores empty values and trailing semicolons', () => {
        // Given
        const root = new TermNode('element', 'root')
        const node = new TermNode('element', 'div')
        node.attributes.set('style', 'color: red;;background-color:;')
        root.insertBefore(node, null)

        // When
        const styles = resolveStyles(root, parseCSS(''))

        // Then
        const s = styles.get(node.id)!
        assert.equal(s.fg, 'red')
        assert.equal(s.bg, 'default')
    })
})
