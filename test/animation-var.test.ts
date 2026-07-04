import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationClock } from '../src/render/animation-clock.js'
import { getKeyframes } from '../src/css/animation.js'
import { collectVariables } from '../src/css/variables.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

function makeAnimatedTree(css: string) {
    const root = new TermNode('element', 'root')
    const el = new TermNode('element', 'div')
    el.attributes.set('class', 'box')
    root.insertBefore(el, null)
    const sheet = parseCSS(css)
    return { root, el, sheet }
}

function applyAt(css: string, elapsedMs: number, scheme: 'dark' | 'light' = 'dark') {
    const { root, el, sheet } = makeAnimatedTree(css)
    let now = 0
    const clock = new AnimationClock(() => now)
    const styles = resolveStyles(root, sheet)
    clock.sync(root, styles, getKeyframes(sheet), {
        variables: collectVariables(root, sheet),
        scheme,
    })
    now = elapsedMs
    clock.apply(styles)
    clock.stop()
    return styles.get(el.id)!
}

describe('keyframes resolve var()', () => {

    it('interpolates between custom-property colour stops', () => {
        // Given
        const css = `
        .box { --start: #000000; --end: #ffffff; animation: fade 1000ms linear; }
        @keyframes fade { from { color: var(--start); } to { color: var(--end); } }
        `

        // When / Then
        assert.equal(applyAt(css, 500).fg, '#808080')
    })

    it('resolves variables against the animated element, not the root', () => {
        // Given: the variable is scoped to .box
        const css = `
        .box { --c: #ff0000; animation: paint 1000ms linear; }
        @keyframes paint { from { color: var(--c); } to { color: var(--c); } }
        `

        // Then
        assert.equal(applyAt(css, 500).fg, '#ff0000')
    })

    it('uses the var() fallback when the property is not defined', () => {
        // Given
        const css = `
        .box { animation: paint 1000ms linear; }
        @keyframes paint { from { color: var(--missing, #00ff00); } to { color: var(--missing, #00ff00); } }
        `

        // Then
        assert.equal(applyAt(css, 500).fg, '#00ff00')
    })
})

describe('keyframes resolve light-dark()', () => {

    it('picks the dark arm under the dark scheme', () => {
        // Given
        const css = `
        .box { animation: fade 1000ms linear; }
        @keyframes fade {
            from { color: light-dark(#111111, #000000); }
            to { color: light-dark(#eeeeee, #ffffff); }
        }
        `

        // Then: midpoint of the dark arms
        assert.equal(applyAt(css, 500, 'dark').fg, '#808080')
    })

    it('picks the light arm under the light scheme', () => {
        // Given
        const css = `
        .box { animation: hold 1000ms linear; }
        @keyframes hold {
            from { color: light-dark(#123456, #000000); }
            to { color: light-dark(#123456, #ffffff); }
        }
        `

        // Then
        assert.equal(applyAt(css, 500, 'light').fg, '#123456')
    })
})
