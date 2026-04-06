import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TermNode } from '../../src/renderer/node.js'
import { parseCSS } from '../../src/css/parser.js'
import { resolveStyles, filterByMedia } from '../../src/css/compute.js'
import { resolveStylesIncremental } from '../../src/css/incremental.js'
import type { MediaContext } from '../../src/css/media.js'

const CSS = `
    :root { --primary: cyan; --accent: yellow; }
    @media (prefers-color-scheme: light) {
        :root { --primary: #0088aa; --accent: #886600; }
    }
    .app { display: flex; flex-direction: column; }
    .title { color: var(--primary); font-weight: bold; }
    .box { border: single; border-color: var(--primary); text-align: center; width: 20cell; }
    .btn { color: var(--accent); }
    .btn:focus { font-weight: bold; color: var(--primary); }
`

function buildTree() {
    const root = new TermNode('element', 'root')
    const app = new TermNode('element', 'div')
    app.attributes.set('class', 'app')
    const title = new TermNode('element', 'span')
    title.attributes.set('class', 'title')
    title.insertBefore(new TermNode('text', 'Title'), null)
    const box = new TermNode('element', 'div')
    box.attributes.set('class', 'box')
    box.insertBefore(new TermNode('text', 'Content'), null)
    const btn = new TermNode('element', 'button')
    btn.attributes.set('class', 'btn')
    btn.insertBefore(new TermNode('text', 'Click'), null)
    app.insertBefore(title, null)
    app.insertBefore(box, null)
    app.insertBefore(btn, null)
    root.insertBefore(app, null)
    return { root, app, title, box, btn }
}

function compareStyles(
    full: Map<number, any>, inc: Map<number, any>, label: string,
) {
    for (const [id, fullStyle] of full) {
        const incStyle = inc.get(id)
        if (!incStyle) continue
        for (const key of Object.keys(fullStyle)) {
            assert.equal(
                incStyle[key], fullStyle[key],
                `${label}: node ${id} .${key} — incremental=${incStyle[key]} vs full=${fullStyle[key]}`,
            )
        }
    }
}

describe('full vs incremental style resolution consistency', () => {

    for (const scheme of ['dark', 'light'] as const) {
        it(`produces identical styles after focus change (${scheme})`, () => {
            const { root, btn } = buildTree()
            const filtered = filterByMedia(parseCSS(CSS),
                { colorScheme: scheme, displayMode: 'terminal', width: 40, height: 20 })

            // Full resolve — initial state
            const styles1 = resolveStyles(root, filtered)

            // Focus the button
            btn.attributes.set('data-focused', 'true')
            btn.invalidateStyle()

            // Incremental resolve
            const incStyles = resolveStylesIncremental(root, filtered, styles1, new Set([btn]))

            // Full resolve with same state
            const fullStyles = resolveStyles(root, filtered)

            compareStyles(fullStyles, incStyles, scheme)
        })

        it(`produces identical styles after class change (${scheme})`, () => {
            const { root, box } = buildTree()
            const filtered = filterByMedia(parseCSS(CSS),
                { colorScheme: scheme, displayMode: 'terminal', width: 40, height: 20 })

            const styles1 = resolveStyles(root, filtered)

            // Change class
            box.attributes.set('class', 'box title')
            box.invalidateStyle()

            const incStyles = resolveStylesIncremental(root, filtered, styles1, new Set([box]))
            const fullStyles = resolveStyles(root, filtered)

            compareStyles(fullStyles, incStyles, scheme)
        })

        it(`produces identical styles after hover change (${scheme})`, () => {
            const { root, title } = buildTree()
            const filtered = filterByMedia(parseCSS(CSS),
                { colorScheme: scheme, displayMode: 'terminal', width: 40, height: 20 })

            const styles1 = resolveStyles(root, filtered)

            // Hover the title
            title.attributes.set('data-hovered', 'true')
            title.invalidateStyle()

            const incStyles = resolveStylesIncremental(root, filtered, styles1, new Set([title]))
            const fullStyles = resolveStyles(root, filtered)

            compareStyles(fullStyles, incStyles, scheme)
        })
    }
})
