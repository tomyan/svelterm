import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeLayout } from '../src/layout/engine.js'
import { defaultStyle, ResolvedStyle } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'

function makeTree(setup: (root: TermNode, styles: Map<number, ResolvedStyle>) => void) {
    const root = new TermNode('element', 'div')
    const styles = new Map<number, ResolvedStyle>()
    styles.set(root.id, defaultStyle('div'))
    setup(root, styles)
    return { root, styles }
}

function addChild(parent: TermNode, tag: string, styles: Map<number, ResolvedStyle>, overrides?: Partial<ResolvedStyle>): TermNode {
    const child = new TermNode('element', tag)
    const style = { ...defaultStyle(tag), ...overrides }
    styles.set(child.id, style)
    parent.insertBefore(child, null)
    return child
}

describe('box-sizing', () => {

    describe('default and parsing', () => {
        it('defaults to border-box', () => {
            // Given
            const style = defaultStyle('div')

            // Then
            assert.equal(style.boxSizing, 'border-box')
        })

        it('parses box-sizing: border-box from CSS', () => {
            // Given
            const root = new TermNode('element', 'div')
            const sheet = parseCSS('div { width: 20cell; padding: 2cell; box-sizing: border-box; }')

            // When
            const styles = resolveStyles(root, sheet)

            // Then
            assert.equal(styles.get(root.id)!.boxSizing, 'border-box')
        })

        it('parses box-sizing: content-box from CSS', () => {
            // Given
            const root = new TermNode('element', 'div')
            const sheet = parseCSS('div { width: 20cell; padding: 2cell; box-sizing: content-box; }')

            // When
            const styles = resolveStyles(root, sheet)

            // Then
            assert.equal(styles.get(root.id)!.boxSizing, 'content-box')
        })
    })

    describe('layout semantics', () => {
        it('border-box: explicit width includes padding (outer = width)', () => {
            // Given — width: 20, padding: 2 on each side
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, {
                    ...defaultStyle('div'),
                    width: 20, paddingLeft: 2, paddingRight: 2,
                    boxSizing: 'border-box',
                })
                addChild(root, 'div', styles)
            })

            // When
            const boxes = computeLayout(root, styles, 80, 24)

            // Then — outer width = 20 (the explicit width)
            assert.equal(boxes.get(root.id)!.width, 20)
            // Child fills inner content area = 20 - 2 - 2 = 16
            assert.equal(boxes.get(root.children[0].id)!.width, 16)
            // Child positioned after left padding
            assert.equal(boxes.get(root.children[0].id)!.x, 2)
        })

        it('content-box: explicit width is content area (outer = width + padding)', () => {
            // Given — width: 20 means 20 cells of content; padding adds outside
            const { root, styles } = makeTree((root, styles) => {
                styles.set(root.id, {
                    ...defaultStyle('div'),
                    width: 20, paddingLeft: 2, paddingRight: 2,
                    boxSizing: 'content-box',
                })
                addChild(root, 'div', styles)
            })

            // When
            const boxes = computeLayout(root, styles, 80, 24)

            // Then — outer width = 20 + 2 + 2 = 24
            assert.equal(boxes.get(root.id)!.width, 24)
            // Child fills inner content area = 20 (the declared width)
            assert.equal(boxes.get(root.children[0].id)!.width, 20)
            // Child positioned after left padding
            assert.equal(boxes.get(root.children[0].id)!.x, 2)
        })

        it('border-box with width:100% + padding fits inside parent', () => {
            // Given — child width:100% + padding shouldn't overflow parent
            const { root, styles } = makeTree((root, styles) => {
                const child = addChild(root, 'div', styles, {
                    width: '100%', paddingLeft: 2, paddingRight: 2,
                    boxSizing: 'border-box',
                })
                addChild(child, 'div', styles)
            })

            // When
            const boxes = computeLayout(root, styles, 40, 10)

            // Then — child is exactly parent's width, no overflow
            assert.equal(boxes.get(root.children[0].id)!.width, 40)
        })
    })
})
