import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { hitTest } from '../src/input/hit.js'

function render(css: string, buildTree: (root: TermNode) => void, width = 10, height = 6) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return { buffer, layout, root }
}

function rowText(buffer: CellBuffer, row: number): string {
    let out = ''
    for (let col = 0; col < buffer.width; col++) {
        out += buffer.getCell(col, row)?.char || ' '
    }
    return out.replace(/\s+$/, '')
}

function el(tag: string, ...children: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    for (const child of children) node.insertBefore(child, null)
    return node
}

function text(content: string): TermNode {
    return new TermNode('text', content)
}

describe('inline formatting context', () => {

    it('flows text across an inline element boundary when wrapping', () => {
        // Given a paragraph whose text is split across a <strong> element
        const strong = el('strong', text('brave new'))
        const p = el('p', text('hello '), strong, text(' world'))

        // When laid out in a 10-cell-wide container
        const { buffer } = render('', (root) => root.insertBefore(p, null))

        // Then lines break browser-style across the element boundary,
        // and continuation lines return to the container's left edge
        assert.equal(rowText(buffer, 0), 'hello')
        assert.equal(rowText(buffer, 1), 'brave new')
        assert.equal(rowText(buffer, 2), 'world')
    })

    it('keeps a word spanning run boundaries unbreakable', () => {
        // Given "aa " then <strong>bb</strong>cc — "bbcc" is one word
        const p = el('p', text('aa '), el('strong', text('bb')), text('cc'))

        // When laid out in a 4-cell-wide container
        const { buffer } = render('', (root) => root.insertBefore(p, null), 4)

        // Then the cross-boundary word wraps as a unit
        assert.equal(rowText(buffer, 0), 'aa')
        assert.equal(rowText(buffer, 1), 'bbcc')
    })

    it('collapses whitespace runs to a single space', () => {
        // Given text with a newline-and-spaces gap (source formatting)
        const p = el('p', text('hello \n   world'))

        // When laid out with plenty of room
        const { buffer } = render('', (root) => root.insertBefore(p, null), 20)

        // Then the gap collapses to one space
        assert.equal(rowText(buffer, 0), 'hello world')
    })

    it('strips leading and trailing whitespace from lines', () => {
        // Given text with leading and trailing spaces
        const p = el('p', text('  hi  '))
        let textNode!: TermNode

        // When laid out
        const { buffer, layout } = render('', (root) => {
            root.insertBefore(p, null)
            textNode = p.children[0]
        }, 10)

        // Then the text starts at the container edge and the box hugs it
        assert.equal(rowText(buffer, 0), 'hi')
        const box = layout.get(textNode.id)
        assert.equal(box?.x, 0)
        assert.equal(box?.width, 2)
    })

    it('styles each fragment from its own element', () => {
        // Given a red <strong> between plain text runs
        const p = el('p', text('aa '), el('strong', text('bb')), text(' cc'))

        // When painted
        const { buffer } = render('strong{color:red}', (root) => root.insertBefore(p, null), 20)

        // Then only the strong's cells are red
        assert.equal(rowText(buffer, 0), 'aa bb cc')
        assert.notEqual(buffer.getCell(0, 0)?.fg, 'red')
        assert.equal(buffer.getCell(3, 0)?.fg, 'red')
        assert.equal(buffer.getCell(4, 0)?.fg, 'red')
        assert.notEqual(buffer.getCell(6, 0)?.fg, 'red')
    })

    it('centers each wrapped line independently', () => {
        // Given centered text that wraps into unequal lines
        const p = el('p', text('aaaaaa bb'))

        // When laid out in a 7-cell centered container
        const { buffer } = render('p{width:7ch;text-align:center}',
            (root) => root.insertBefore(p, null), 7)

        // Then each line centers by its own width
        assert.equal(buffer.getCell(0, 0)?.char, 'a') // (7-6)/2 = 0
        assert.equal(buffer.getCell(2, 1)?.char, 'b') // (7-2)/2 = 2
        assert.equal(buffer.getCell(3, 1)?.char, 'b')
    })

    it('gives an inline element the union rect of its fragments', () => {
        // Given a <strong> whose text lands entirely on the second line
        const strong = el('strong', text('brave new'))
        const p = el('p', text('hello '), strong, text(' world'))

        // When laid out in a 10-cell-wide container
        const { layout } = render('', (root) => root.insertBefore(p, null))

        // Then the strong's box bounds its fragments
        const box = layout.get(strong.id)
        assert.deepEqual(
            { x: box?.x, y: box?.y, width: box?.width, height: box?.height },
            { x: 0, y: 1, width: 9, height: 1 },
        )
    })

    it('paints inline background only on fragment cells', () => {
        // Given a highlighted span that wraps across two lines
        const span = el('span', text('bb cc'))
        span.attributes.set('class', 'hl')
        const p = el('p', text('aaaa '), span)

        // When laid out in an 8-cell-wide container
        const { buffer } = render('.hl{background-color:blue}',
            (root) => root.insertBefore(p, null), 8)

        // Then fragment cells get the background…
        assert.equal(buffer.getCell(5, 0)?.bg, 'blue')
        assert.equal(buffer.getCell(0, 1)?.bg, 'blue')
        // …but cells inside the union rect that hold no fragment do not
        assert.notEqual(buffer.getCell(3, 1)?.bg, 'blue')
    })

    it('keeps white-space:pre text out of the IFC', () => {
        // Given preformatted text with internal spacing
        const pre = el('div', text('a   b'))
        pre.attributes.set('class', 'pre')

        // When laid out
        const { buffer } = render('.pre{white-space:pre}',
            (root) => root.insertBefore(pre, null), 10)

        // Then the spacing is preserved exactly
        assert.equal(buffer.getCell(0, 0)?.char, 'a')
        assert.equal(buffer.getCell(4, 0)?.char, 'b')
    })

    it('collapses block margins across whitespace-only text', () => {
        // Given two blocks separated by inter-element whitespace
        const a = el('div', text('a'))
        a.attributes.set('class', 'a')
        const b = el('div', text('b'))
        b.attributes.set('class', 'b')

        // When laid out with adjoining vertical margins
        const { layout } = render('.a{margin-bottom:2ch}.b{margin-top:3ch}', (root) => {
            root.insertBefore(a, null)
            root.insertBefore(text('\n  '), null)
            root.insertBefore(b, null)
        }, 10)

        // Then the margins collapse to the larger of the two
        assert.equal(layout.get(a.id)?.y, 0)
        assert.equal(layout.get(b.id)?.y, 4)
    })

    it('hit-tests a wrapped inline element via its fragments', () => {
        // Given a span that wraps onto a second line
        const span = el('span', text('bb cc'))
        const p = el('p', text('aaaa '), span)
        let root!: TermNode

        // When laid out in an 8-cell-wide container
        // (span fragments: "bb" at (5,0), "cc" at (0,1))
        const { layout, root: r } = render('', (rootNode) => {
            rootNode.insertBefore(p, null)
            root = rootNode
        }, 8)

        // Then a point on the continuation-line fragment hits the span…
        assert.equal(hitTest(root, layout, 0, 1), span)
        assert.equal(hitTest(root, layout, 5, 0), span)
        // …plain sibling text hits the paragraph…
        assert.equal(hitTest(root, layout, 1, 0), p)
        // …and a ragged cell inside the union rect falls through to the
        // paragraph, not the span
        assert.equal(hitTest(root, layout, 3, 1), p)
    })

    it('still hit-tests a block element on its padding cells', () => {
        // Given a padded block
        const div = el('div', text('x'))
        div.attributes.set('class', 'pad')
        let root!: TermNode

        // When laid out
        const { layout, root: r } = render('.pad{padding:1ch}', (rootNode) => {
            rootNode.insertBefore(div, null)
            root = rootNode
        }, 10)

        // Then its padding cell still hits the block itself
        assert.equal(hitTest(root, layout, 0, 0), div)
    })

    it('wraps an inline-block whole when it does not fit the line', () => {
        // Given text followed by a fixed-width inline-block
        const atom = el('span', text('WXYZ'))
        atom.attributes.set('class', 'ib')
        const p = el('p', text('aaa '), atom)

        // When the atom cannot fit after the text on a 6-cell line
        const { buffer, layout } = render('.ib{display:inline-block;width:4ch;height:1ch}',
            (root) => root.insertBefore(p, null), 6)

        // Then it moves to the next line as one unit
        assert.equal(rowText(buffer, 0), 'aaa')
        assert.equal(rowText(buffer, 1), 'WXYZ')
        assert.equal(layout.get(atom.id)?.x, 0)
        assert.equal(layout.get(atom.id)?.y, 1)
    })
})
