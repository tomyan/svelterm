import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationClock } from '../src/render/animation-clock.js'
import { AnimationRunner } from '../src/css/animation-runner.js'
import { parseEasing } from '../src/css/easing.js'
import { getKeyframes } from '../src/css/animation.js'
import { collectVariables } from '../src/css/variables.js'
import { parseCSS, type KeyframeStop } from '../src/css/parser.js'
import { resolveStyles, defaultStyle, type ResolvedStyle } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

const NO_KEYFRAMES = new Map()

function makeTree(css: string, initialClass: string) {
    const root = new TermNode('element', 'root')
    const el = new TermNode('element', 'div')
    el.attributes.set('class', initialClass)
    root.insertBefore(el, null)
    const sheet = parseCSS(css)
    return { root, el, sheet }
}

describe('per-property transition duration and timing', () => {

    it('parses comma-separated per-property groups from the shorthand', () => {
        // Given
        const { root, el, sheet } = makeTree(
            '.box { transition: color 100ms linear, width 400ms ease-in; }', 'box')

        // When
        const style = resolveStyles(root, sheet).get(el.id)!

        // Then
        assert.deepEqual(style.transitions, [
            { property: 'color', duration: 100, timing: 'linear' },
            { property: 'width', duration: 400, timing: 'ease-in' },
        ])
    })

    it('pairs longhand lists cyclically per spec', () => {
        const { root, el, sheet } = makeTree(
            '.box { transition-property: color, width, gap; transition-duration: 100ms, 200ms; transition-timing-function: linear; }', 'box')
        const style = resolveStyles(root, sheet).get(el.id)!
        assert.deepEqual(style.transitions, [
            { property: 'color', duration: 100, timing: 'linear' },
            { property: 'width', duration: 200, timing: 'linear' },
            { property: 'gap', duration: 100, timing: 'linear' },
        ])
    })

    it('runs each property on its own duration', () => {
        // Given: colour finishes at 100ms, width at 1000ms
        let now = 0
        const css = `
        .box { color: #000000; width: 0cell; transition: color 100ms linear, width 1000ms linear; }
        .box.alt { color: #ffffff; width: 10cell; }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        const restyle = (cls: string) => {
            el.attributes.set('class', cls)
            const styles = resolveStyles(root, sheet)
            clock.sync(root, styles, NO_KEYFRAMES)
            clock.syncTransitions(root, styles)
            return styles
        }
        restyle('box')

        // When: switch, then look at 500ms in
        now = 0
        const styles = restyle('box alt')
        now = 500
        clock.apply(styles)
        clock.stop()

        // Then: colour transition (100ms) already done; width (1000ms) halfway
        const style = styles.get(el.id)!
        assert.equal(style.fg, '#ffffff')
        assert.equal(style.width, 5)
    })
})

describe('interrupted transitions continue from the current value', () => {

    it('a reversal mid-flight starts from the blended value, not the old target', () => {
        // Given: black→white over 1000ms, reversed at 500ms
        let now = 0
        const css = `
        .box { color: #000000; transition: color 1000ms linear; }
        .box.alt { color: #ffffff; }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        const restyle = (cls: string) => {
            el.attributes.set('class', cls)
            const styles = resolveStyles(root, sheet)
            clock.sync(root, styles, NO_KEYFRAMES)
            clock.syncTransitions(root, styles)
            return styles
        }
        restyle('box')
        now = 0
        let styles = restyle('box alt')     // start 000→fff
        now = 500
        clock.apply(styles)                 // halfway: #808080

        // When: reverse back to black at t=500
        styles = restyle('box')
        now = 600                            // 100ms into the reversal
        clock.apply(styles)
        clock.stop()

        // Then: from #808080 toward #000000, 10% along ≈ #737373 — NOT
        // from #ffffff (which would give #e6e6e6)
        const fg = styles.get(el.id)!.fg!
        const channel = parseInt(fg.slice(1, 3), 16)
        assert.ok(channel < 0x80, `expected below 0x80, got ${fg}`)
        assert.ok(channel > 0x60, `expected near 0x73, got ${fg}`)
    })
})

describe('per-keyframe animation-timing-function', () => {

    it('a timing function declared in a keyframe applies from that stop', () => {
        // Given: linear on the element, but the from-stop declares steps(1)
        // (jump-at-end): the value must HOLD the from value all segment.
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [
                { property: 'color', value: '#000000' },
                { property: 'animation-timing-function', value: 'step-end' },
            ] },
            { offset: 1, declarations: [{ property: 'color', value: '#ffffff' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1, parseEasing('linear')!)

        // When
        const style = defaultStyle()
        runner.apply(style, 500)

        // Then: still the from colour — step-end holds until the segment end
        assert.equal(style.fg, '#000000')
    })
})

describe('keyframe var() re-resolution mid-animation', () => {

    it('a scheme flip retargets a light-dark() keyframe without restarting', () => {
        // Given: animation from light-dark colours, discovered under dark
        let now = 0
        const css = `
        .box { animation: fade 1000ms linear; }
        @keyframes fade {
            from { color: light-dark(#000000, #222222); }
            to { color: light-dark(#ffffff, #cccccc); }
        }
        `
        const { root, el, sheet } = makeTree(css, 'box')
        const clock = new AnimationClock(() => now)
        const styles = resolveStyles(root, sheet)
        const resolution = (scheme: 'dark' | 'light') => ({
            variables: collectVariables(root, sheet), scheme,
        })
        clock.sync(root, styles, getKeyframes(sheet), resolution('dark'))

        // When: at 500ms the scheme flips to light; re-sync (as run() does)
        now = 500
        clock.sync(root, styles, getKeyframes(sheet), resolution('light'))
        clock.apply(styles)
        clock.stop()

        // Then: midpoint of the LIGHT arms (#000000→#ffffff → #808080),
        // and the animation did not restart (still at its 500ms midpoint)
        assert.equal(styles.get(el.id)!.fg, '#808080')
    })
})

describe('eased step timing for cell lengths', () => {

    it('length steps fire on the easing curve, not linearly', () => {
        // Given: width 0→10 cells with ease-in over 1000ms
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'width', value: '0cell' }] },
            { offset: 1, declarations: [{ property: 'width', value: '10cell' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1, parseEasing('ease-in')!)

        // When
        const at = (ms: number) => {
            const style = defaultStyle()
            runner.apply(style, ms)
            return style.width
        }

        // Then: at half time, ease-in is well below half distance
        assert.ok((at(500) as number) < 4, `expected < 4 cells at 500ms, got ${at(500)}`)
        assert.equal(at(1000), 10)
    })
})
