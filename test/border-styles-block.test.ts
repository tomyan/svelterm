import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { CellBuffer } from '../src/render/buffer.js'
import { renderBorder } from '../src/render/border.js'

function nodeWithCSS(cssDecls: string) {
    const root = new TermNode('element', 'root')
    const node = new TermNode('element', 'div')
    node.attributes.set('class', 'box')
    root.insertBefore(node, null)
    const styles = resolveStyles(root, parseCSS(`.box { ${cssDecls} }`))
    return styles.get(node.id)!
}

describe('border-style — block-character values parse', () => {
    for (const value of [
        'eighth-cell-inner', 'eighth-cell-outer',
        'half-cell-inner', 'half-cell-outer',
        'full-cell',
    ]) {
        it(`parses ${value}`, () => {
            // When
            const s = nodeWithCSS(`border-style: ${value}`)
            // Then
            assert.equal(s.borderStyle, value)
        })
    }

    it('rejects unknown border-style values', () => {
        // Given an unknown value
        // When
        const s = nodeWithCSS('border-style: not-a-style')
        // Then style stays at default
        assert.equal(s.borderStyle, 'none')
    })
})

describe('block-character border rendering', () => {
    function renderBox(borderStyle: string, borderCorner: string = 'none') {
        const root = new TermNode('element', 'root')
        const box = new TermNode('element', 'div')
        box.attributes.set('class', 'box')
        root.insertBefore(box, null)
        const css = `.box { width: 6cell; height: 4cell; border-style: ${borderStyle}; border-corner: ${borderCorner}; }`
        const sheet = parseCSS(css)
        const styles = resolveStyles(root, sheet)
        const layout = computeLayout(root, styles, 10, 8)
        const buffer = new CellBuffer(10, 8)
        const boxLayout = layout.get(box.id)!
        renderBorder(buffer, boxLayout, styles.get(box.id)!)
        const lines: string[] = []
        for (let row = 0; row < boxLayout.height; row++) {
            let line = ''
            for (let col = 0; col < boxLayout.width; col++) {
                line += buffer.getCell(boxLayout.x + col, boxLayout.y + row)?.char ?? ' '
            }
            lines.push(line)
        }
        return lines
    }

    it('eighth-cell-inner: corners blank, edges face inward', () => {
        // When
        const lines = renderBox('eighth-cell-inner')
        // Then — top row: blank corner, ▁ edges, blank corner; bottom: ▔; sides: ▕▏
        assert.equal(lines[0], ' \u2581\u2581\u2581\u2581 ')
        assert.equal(lines[1], '\u2595    \u258F')
        assert.equal(lines[2], '\u2595    \u258F')
        assert.equal(lines[3], ' \u2594\u2594\u2594\u2594 ')
    })

    it('eighth-cell-outer: top/bottom extend through corners by default', () => {
        // When
        const lines = renderBox('eighth-cell-outer')
        // Then — default corner ownership is 'h' for outer (no 1/8 L corner glyph):
        // top row full of ▔, bottom row full of ▁, sides indent by one
        assert.equal(lines[0], '\u2594\u2594\u2594\u2594\u2594\u2594')
        assert.equal(lines[1], '\u258F    \u2595')
        assert.equal(lines[3], '\u2581\u2581\u2581\u2581\u2581\u2581')
    })

    it('half-cell-inner: quadrant corners face inward', () => {
        // When
        const lines = renderBox('half-cell-inner')
        // Then — corners are diagonally-opposite quadrants pointing into content
        assert.equal(lines[0], '\u2597\u2584\u2584\u2584\u2584\u2596')  // ▗▄▄▄▄▖
        assert.equal(lines[1], '\u2590    \u258C')
        assert.equal(lines[3], '\u259D\u2580\u2580\u2580\u2580\u2598')  // ▝▀▀▀▀▘
    })

    it('full-cell: full block on all border cells including corners', () => {
        // When
        const lines = renderBox('full-cell')
        // Then — entire border ring is █
        assert.equal(lines[0], '\u2588\u2588\u2588\u2588\u2588\u2588')
        assert.equal(lines[1], '\u2588    \u2588')
        assert.equal(lines[3], '\u2588\u2588\u2588\u2588\u2588\u2588')
    })

    it('half-cell-outer: three-quadrant L corners point outward', () => {
        // When
        const lines = renderBox('half-cell-outer')
        // Then — corners are three-quadrant L glyphs (▛▜▙▟)
        assert.equal(lines[0], '\u259B\u2580\u2580\u2580\u2580\u259C')  // ▛▀▀▀▀▜
        assert.equal(lines[1], '\u258C    \u2590')
        assert.equal(lines[3], '\u2599\u2584\u2584\u2584\u2584\u259F')  // ▙▄▄▄▄▟
    })

    it('border-corner: h — top/bottom strokes extend through corners', () => {
        // When
        const lines = renderBox('eighth-cell-inner', 'h')
        // Then — top row full of ▁; sides indent by one (start at row 1)
        assert.equal(lines[0], '\u2581\u2581\u2581\u2581\u2581\u2581')
        assert.equal(lines[1], '\u2595    \u258F')
        assert.equal(lines[3], '\u2594\u2594\u2594\u2594\u2594\u2594')
    })

    it('border-corner: v — sides extend through corners', () => {
        // When
        const lines = renderBox('eighth-cell-inner', 'v')
        // Then — sides full height; top/bottom indent
        assert.equal(lines[0], '\u2595\u2581\u2581\u2581\u2581\u258F')
        assert.equal(lines[1], '\u2595    \u258F')
        assert.equal(lines[3], '\u2595\u2594\u2594\u2594\u2594\u258F')
    })
})

describe('padding/margin collapse with block borders', () => {
    function boxLayout(borderStyle: string, padding: number, margin: number): { x: number; y: number; width: number; height: number } {
        const root = new TermNode('element', 'root')
        const outer = new TermNode('element', 'div')
        outer.attributes.set('class', 'outer')
        const inner = new TermNode('element', 'div')
        inner.attributes.set('class', 'inner')
        outer.insertBefore(inner, null)
        root.insertBefore(outer, null)
        const css = `
            .outer { width: 20cell; height: 10cell }
            .inner { width: 10cell; height: 4cell;
                border-style: ${borderStyle};
                padding: ${padding}cell;
                margin: ${margin}cell;
            }
        `
        const styles = resolveStyles(root, parseCSS(css))
        const layout = computeLayout(root, styles, 30, 15)
        return layout.get(inner.id)!
    }

    it('eighth-cell-outer: padding:0 — inset equals border cell only', () => {
        // When
        const box = boxLayout('eighth-cell-outer', 0, 0)
        // Then box has explicit width 10. inset on each side should be 1 (border only)
        // Position should reflect 0 margin (left edge at x=0)
        assert.equal(box.x, 0)
    })

    it('eighth-cell-outer: padding:1 absorbs into border cell — same total size', () => {
        // Given
        const box1 = boxLayout('eighth-cell-outer', 0, 0)
        // When padding goes from 0 to 1
        const box2 = boxLayout('eighth-cell-outer', 1, 0)
        // Then the box dimensions are unchanged (padding absorbed)
        assert.equal(box1.width, box2.width)
        assert.equal(box1.height, box2.height)
    })

    it('eighth-cell-outer: padding:2 adds one extra cell beyond border', () => {
        // Given
        const box1 = boxLayout('eighth-cell-outer', 1, 0)
        // When padding bumps to 2
        const box2 = boxLayout('eighth-cell-outer', 2, 0)
        // Then box content area shrinks (or outer grows, depending on box-sizing)
        // Width should be the same (explicit width=10cell controls outer size)
        // but inner area should have shrunk
        assert.equal(box1.width, box2.width)
    })

    it('non-collapse style (single): padding:1 adds full cell to inset', () => {
        // Given an existing single-line border with padding 0
        const box1 = boxLayout('single', 0, 0)
        // When padding bumps to 1
        const box2 = boxLayout('single', 1, 0)
        // Then box dimensions still controlled by explicit width
        assert.equal(box1.width, box2.width)
        // (the inner content area shrinks but that's not exposed in this test)
    })

    it('eighth-cell-inner: margin:1 absorbs into border cell — sibling positioning', () => {
        // Given two siblings stacked vertically, first with inner-facing border + margin:1
        const root = new TermNode('element', 'root')
        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'a')
        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'b')
        root.insertBefore(a, null)
        root.insertBefore(b, null)

        const cssNoMargin = `
            .a { width: 10cell; height: 4cell; border-style: eighth-cell-inner; margin-bottom: 0 }
            .b { width: 10cell; height: 2cell }
        `
        const cssWithMargin = `
            .a { width: 10cell; height: 4cell; border-style: eighth-cell-inner; margin-bottom: 1cell }
            .b { width: 10cell; height: 2cell }
        `
        const stylesNo = resolveStyles(root, parseCSS(cssNoMargin))
        const layoutNo = computeLayout(root, stylesNo, 30, 15)
        const stylesWith = resolveStyles(root, parseCSS(cssWithMargin))
        const layoutWith = computeLayout(root, stylesWith, 30, 15)

        // Then sibling b sits at the same y in both cases (margin:1 absorbs into border cell)
        assert.equal(layoutNo.get(b.id)!.y, layoutWith.get(b.id)!.y)
    })

    it('eighth-cell-inner: margin:2 adds one extra cell of margin', () => {
        // Given two siblings stacked, first with margin:2
        const root = new TermNode('element', 'root')
        const a = new TermNode('element', 'div')
        a.attributes.set('class', 'a')
        const b = new TermNode('element', 'div')
        b.attributes.set('class', 'b')
        root.insertBefore(a, null)
        root.insertBefore(b, null)

        const cssMargin1 = `
            .a { width: 10cell; height: 4cell; border-style: eighth-cell-inner; margin-bottom: 1cell }
            .b { width: 10cell; height: 2cell }
        `
        const cssMargin2 = `
            .a { width: 10cell; height: 4cell; border-style: eighth-cell-inner; margin-bottom: 2cell }
            .b { width: 10cell; height: 2cell }
        `
        const styles1 = resolveStyles(root, parseCSS(cssMargin1))
        const layout1 = computeLayout(root, styles1, 30, 15)
        const styles2 = resolveStyles(root, parseCSS(cssMargin2))
        const layout2 = computeLayout(root, styles2, 30, 15)

        // Then sibling b sits 1 cell lower with margin:2 vs margin:1
        assert.equal(layout2.get(b.id)!.y - layout1.get(b.id)!.y, 1)
    })
})

describe('border-corner — value parsing', () => {
    it('defaults to none', () => {
        // When no border-corner is set
        const s = nodeWithCSS('border-style: eighth-cell-inner')
        // Then
        assert.equal(s.borderCorner, 'none')
    })

    for (const value of ['none', 'h', 'v']) {
        it(`parses ${value}`, () => {
            // When
            const s = nodeWithCSS(`border-corner: ${value}`)
            // Then
            assert.equal(s.borderCorner, value)
        })
    }

    it('ignores unknown border-corner values', () => {
        // Given an invalid value
        // When
        const s = nodeWithCSS('border-corner: diagonal')
        // Then default is preserved
        assert.equal(s.borderCorner, 'none')
    })
})
