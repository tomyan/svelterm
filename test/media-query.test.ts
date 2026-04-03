import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { computeLayout } from '../src/layout/engine.js'
import { paint } from '../src/render/paint.js'
import { CellBuffer } from '../src/render/buffer.js'
import { TermNode } from '../src/renderer/node.js'
import type { MediaContext } from '../src/css/media.js'

function render(
    css: string,
    buildTree: (root: TermNode) => void,
    media: MediaContext,
    width = 40, height = 5,
) {
    const root = new TermNode('element', 'root')
    const stylesheet = parseCSS(css)
    buildTree(root)
    const styles = resolveStyles(root, stylesheet, media)
    const layout = computeLayout(root, styles, width, height)
    const buffer = new CellBuffer(width, height)
    paint(root, buffer, styles, layout)
    return buffer
}

describe('@media parsing', () => {

    it('parses @media block with nested rules', () => {
        const sheet = parseCSS('@media (prefers-color-scheme: dark) { .foo { color: white; } }')
        assert.equal(sheet.rules.length, 1)
        assert.ok(sheet.rules[0].media)
        assert.equal(sheet.rules[0].media, 'prefers-color-scheme: dark')
        assert.deepEqual(sheet.rules[0].selectors, ['.foo'])
        assert.equal(sheet.rules[0].declarations[0].property, 'color')
    })

    it('parses multiple rules inside @media', () => {
        const sheet = parseCSS('@media (prefers-color-scheme: dark) { .a { color: white; } .b { color: gray; } }')
        assert.equal(sheet.rules.length, 2)
        assert.equal(sheet.rules[0].media, 'prefers-color-scheme: dark')
        assert.equal(sheet.rules[1].media, 'prefers-color-scheme: dark')
    })

    it('mixes @media and non-media rules', () => {
        const sheet = parseCSS('.base { color: red; } @media (prefers-color-scheme: dark) { .base { color: white; } }')
        assert.equal(sheet.rules.length, 2)
        assert.equal(sheet.rules[0].media, undefined)
        assert.equal(sheet.rules[1].media, 'prefers-color-scheme: dark')
    })
})

describe('media query evaluation', () => {

    it('dark mode applies dark rules', () => {
        const buffer = render(
            ':root{--text:black}@media(prefers-color-scheme:dark){:root{--text:white}}.t{color:var(--text)}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'dark', displayMode: 'terminal', width: 40, height: 5 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'white')
    })

    it('light mode applies light rules', () => {
        const buffer = render(
            ':root{--text:white}@media(prefers-color-scheme:light){:root{--text:black}}.t{color:var(--text)}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'light', displayMode: 'terminal', width: 40, height: 5 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'black')
    })

    it('display-mode:terminal matches in terminal context', () => {
        const buffer = render(
            '@media(display-mode:terminal){.t{color:cyan}}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'dark', displayMode: 'terminal', width: 40, height: 5 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'cyan')
    })

    it('display-mode:screen does not match in terminal context', () => {
        const buffer = render(
            '.t{color:red}@media(display-mode:screen){.t{color:blue}}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'dark', displayMode: 'terminal', width: 40, height: 5 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'red') // screen rule not applied
    })

    it('width media query matches when terminal is wide enough', () => {
        const buffer = render(
            '.t{color:red}@media(min-width:30){.t{color:green}}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'dark', displayMode: 'terminal', width: 80, height: 24 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'green')
    })

    it('width media query does not match when terminal is narrow', () => {
        const buffer = render(
            '.t{color:red}@media(min-width:100){.t{color:green}}',
            (root) => {
                const el = new TermNode('element', 'span')
                el.attributes.set('class', 't')
                const text = new TermNode('text', 'Hi')
                el.insertBefore(text, null)
                root.insertBefore(el, null)
            },
            { colorScheme: 'dark', displayMode: 'terminal', width: 80, height: 24 },
        )
        assert.equal(buffer.getCell(0, 0)?.fg, 'red')
    })
})
