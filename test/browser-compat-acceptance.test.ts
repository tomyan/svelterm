import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import { parseCSS } from '../src/css/parser.js'
import { DEFAULT_STYLESHEET } from '../src/css/defaults.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'

const WIDTH = 60
const HEIGHT = 20

function render(root: TermNode, css: string) {
    const stylesheet = parseCSS(DEFAULT_STYLESHEET + css)
    const styles = resolveStyles(root, stylesheet)
    const layout = computeLayout(root, styles, WIDTH, HEIGHT)
    const buffer = new CellBuffer(WIDTH, HEIGHT)
    paint(root, buffer, styles, layout)
    return { buffer, styles, layout }
}

function el(tag: string, attrs?: Record<string, string>, ...children: TermNode[]): TermNode {
    const node = new TermNode('element', tag)
    if (attrs) for (const [k, v] of Object.entries(attrs)) node.attributes.set(k, v)
    for (const child of children) node.insertBefore(child, null)
    return node
}

function text(value: string): TermNode {
    return new TermNode('text', value)
}

function bufferText(buffer: CellBuffer): string {
    let out = ''
    for (let row = 0; row < HEIGHT; row++) {
        for (let col = 0; col < WIDTH; col++) out += buffer.getCell(col, row)?.char ?? ' '
        out += '\n'
    }
    return out
}

describe('browser-compat acceptance', () => {

    it('renders a pasted-from-a-website card with zero terminal-specific CSS', () => {
        // Given — browser-flavoured markup and CSS only (px styling included)
        const root = el('root', {},
            el('div', { class: 'card' },
                el('h2', {}, text('Release notes')),
                el('a', { href: 'https://example.com/notes.pdf' }, text('download')),
                el('ul', {},
                    el('li', {}, text('faster startup')),
                    el('li', {}, text('bug fixes')),
                ),
                el('label', { class: 'new' }, text('Subscribe')),
                el('input', { type: 'checkbox', checked: 'true' }),
                el('progress', { value: '70', max: '100' }),
            ),
        )
        const css = `
            .card { padding: 8px; border-radius: 6px; box-shadow: 0 2px 8px #0004; }
            .card h2 { font-size: 1.4rem; letter-spacing: 0.02em; }
            a[href$=".pdf"]::after { content: " [pdf]"; color: red; }
            .new::after { content: " (new)"; }
            li { transform: translateX(2px); }
        `

        // When
        const { buffer } = render(root, css)
        const rendered = bufferText(buffer)

        // Then — structure renders, pseudo-content and attribute matching work
        assert.ok(rendered.includes('Release notes'))
        assert.ok(rendered.includes('download [pdf]'))
        assert.ok(rendered.includes('faster startup'))
        assert.ok(rendered.includes('Subscribe (new)'))
        assert.ok(rendered.includes('[x]'))
        assert.ok(rendered.includes('█'))
    })

    it('parses and drops every out-of-scope declaration without error', () => {
        // Given — the bucket-3 list from DESIGN-browser-compat.md
        const root = el('root', {}, el('div', { class: 'x' }, text('still here')))
        const css = `
            .x {
                width: 200px; margin: 1.5em; padding: 2rem; top: 4ex; gap: 10vw; height: 5vh;
                font-size: 18px; font-family: "Comic Sans MS"; line-height: 1.8;
                letter-spacing: 2px; word-spacing: 4px;
                border-radius: 8px; box-shadow: 0 0 4px red; outline: 2px solid blue;
                filter: blur(2px); backdrop-filter: saturate(2);
                transform: rotate(3deg) scale(1.1); perspective: 100px;
                background-image: url(x.png); float: left;
            }
        `

        // When / Then — no crash, content still renders, px lengths did not apply
        const { buffer, styles, layout } = render(root, css)
        assert.ok(bufferText(buffer).includes('still here'))
        const card = root.children[0]
        assert.equal(styles.get(card.id)?.width, 0) // 200px dropped to 0, auto-filled by block layout
        assert.equal(layout.get(card.id)?.x, 0) // margins/padding in px did not move it
    })
})
