import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { resolveStylesIncremental } from '../src/css/incremental.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

describe('incremental style resolve paint-only changes', () => {

    it('color change does not trigger layout callback', () => {
        // Given: a styled tree
        const root = new TermNode('element', 'root')
        const child = new TermNode('element', 'div')
        child.attributes.set('class', 'box')
        root.insertBefore(child, null)

        const css1 = parseCSS('.box { color: red; width: 10cell; }')
        const styles1 = resolveStyles(root, css1)

        // When: only color changes
        const css2 = parseCSS('.box { color: blue; width: 10cell; }')
        const layoutAffected: TermNode[] = []
        child.invalidateStyle()
        resolveStylesIncremental(
            root, css2, styles1, new Set([child]),
            undefined,
            (node) => { layoutAffected.push(node) },
        )

        // Then: no layout callback fired
        assert.equal(layoutAffected.length, 0)
    })

    it('width change does trigger layout callback', () => {
        // Given
        const root = new TermNode('element', 'root')
        const child = new TermNode('element', 'div')
        child.attributes.set('class', 'box')
        root.insertBefore(child, null)

        const css1 = parseCSS('.box { color: red; width: 10cell; }')
        const styles1 = resolveStyles(root, css1)

        // When: width changes
        const css2 = parseCSS('.box { color: red; width: 20cell; }')
        const layoutAffected: TermNode[] = []
        child.invalidateStyle()
        resolveStylesIncremental(
            root, css2, styles1, new Set([child]),
            undefined,
            (node) => { layoutAffected.push(node) },
        )

        // Then: layout callback fired
        assert.equal(layoutAffected.length, 1)
        assert.equal(layoutAffected[0], child)
    })
})
