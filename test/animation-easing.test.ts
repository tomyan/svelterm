import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationRunner } from '../src/css/animation-runner.js'
import { defaultStyle, resolveStyles, type ResolvedStyle } from '../src/css/compute.js'
import { parseEasing } from '../src/css/easing.js'
import { parseCSS } from '../src/css/parser.js'
import { TermNode } from '../src/renderer/node.js'
import type { KeyframeStop } from '../src/css/parser.js'

const RED_TO_BLUE: KeyframeStop[] = [
    { offset: 0, declarations: [{ property: 'color', value: '#ff0000' }] },
    { offset: 1, declarations: [{ property: 'color', value: '#0000ff' }] },
]

function styleAt(runner: AnimationRunner, elapsedMs: number): ResolvedStyle {
    const style = defaultStyle()
    runner.apply(style, elapsedMs)
    return style
}

function redChannel(fg: string | null): number {
    const match = /^#([0-9a-f]{2})/i.exec(fg ?? '')
    assert.ok(match, `expected hex colour, got ${fg}`)
    return parseInt(match![1], 16)
}

describe('AnimationRunner easing', () => {

    it('defaults to linear when no easing is given', () => {
        // Given
        const runner = new AnimationRunner(RED_TO_BLUE, 1000, 1)

        // When
        const style = styleAt(runner, 500)

        // Then: midpoint is the linear mix
        assert.equal(redChannel(style.fg), 0x80)
    })

    it('applies ease-in so the midpoint lags the linear mix', () => {
        // Given
        const runner = new AnimationRunner(RED_TO_BLUE, 1000, 1, parseEasing('ease-in')!)

        // When
        const style = styleAt(runner, 500)

        // Then: less far along than linear — red channel still high
        assert.ok(redChannel(style.fg) > 0x80)
    })

    it('applies ease-out so the midpoint leads the linear mix', () => {
        // Given
        const runner = new AnimationRunner(RED_TO_BLUE, 1000, 1, parseEasing('ease-out')!)

        // When
        const style = styleAt(runner, 500)

        // Then
        assert.ok(redChannel(style.fg) < 0x80)
    })

    it('eases within each keyframe segment, not across the whole animation', () => {
        // Given: two segments; ease-in restarts at each stop
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'color', value: '#000000' }] },
            { offset: 0.5, declarations: [{ property: 'color', value: '#800080' }] },
            { offset: 1, declarations: [{ property: 'color', value: '#ffffff' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1, parseEasing('ease-in')!)

        // When: just after the middle stop, progress inside segment two is
        // small, so easing pins the value near the middle stop exactly
        const style = styleAt(runner, 510)

        // Then
        assert.ok(Math.abs(redChannel(style.fg) - 0x80) < 8)
    })

    it('steps easing switches discretely between keyframe values', () => {
        // Given
        const runner = new AnimationRunner(RED_TO_BLUE, 1000, 1, parseEasing('steps(2)')!)

        // Then: first half holds red exactly, second half the midpoint mix
        assert.equal(redChannel(styleAt(runner, 200).fg), 0xff)
        assert.equal(redChannel(styleAt(runner, 400).fg), 0xff)
        assert.equal(redChannel(styleAt(runner, 600).fg), 0x80)
    })

    it('non-interpolable values switch at the eased midpoint', () => {
        // Given: font-weight flips from normal to bold; ease-in reaches
        // eased progress 0.5 later than linear time 0.5
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: [{ property: 'font-weight', value: 'normal' }] },
            { offset: 1, declarations: [{ property: 'font-weight', value: 'bold' }] },
        ]
        const runner = new AnimationRunner(stops, 1000, 1, parseEasing('ease-in')!)

        // Then
        assert.equal(styleAt(runner, 550).bold, false)
        assert.equal(styleAt(runner, 800).bold, true)
    })
})

describe('animation-timing-function resolution', () => {

    function resolveRoot(css: string, tag = 'div'): ResolvedStyle {
        const root = new TermNode('element', tag)
        const styles = resolveStyles(root, parseCSS(css))
        return styles.get(root.id)!
    }

    it('resolves the animation-timing-function longhand', () => {
        // Given / When
        const style = resolveRoot('div { animation-name: pulse; animation-duration: 1s; animation-timing-function: ease-in-out; }')

        // Then
        assert.equal(style.animationTimingFunction, 'ease-in-out')
    })

    it('defaults animation-timing-function to ease per spec', () => {
        const style = resolveRoot('div { animation-name: pulse; animation-duration: 1s; }')
        assert.equal(style.animationTimingFunction, 'ease')
    })

    it('picks the timing function out of the animation shorthand', () => {
        const style = resolveRoot('div { animation: pulse 2s ease-in-out infinite; }')
        assert.equal(style.animationName, 'pulse')
        assert.equal(style.animationDuration, 2000)
        assert.equal(style.animationTimingFunction, 'ease-in-out')
    })

    it('keeps cubic-bezier with internal spaces intact in the shorthand', () => {
        const style = resolveRoot('div { animation: slide 1s cubic-bezier(0.4, 0, 0.2, 1); }')
        assert.equal(style.animationName, 'slide')
        assert.equal(style.animationTimingFunction, 'cubic-bezier(0.4, 0, 0.2, 1)')
    })

    it('keeps steps() intact in the shorthand', () => {
        const style = resolveRoot('div { animation: blink 1s steps(2, start) infinite; }')
        assert.equal(style.animationName, 'blink')
        assert.equal(style.animationTimingFunction, 'steps(2, start)')
    })

    it('resolves the transition-timing-function longhand and shorthand', () => {
        const longhand = resolveRoot('div { transition-property: color; transition-duration: 1s; transition-timing-function: ease-out; }')
        assert.equal(longhand.transitionTimingFunction, 'ease-out')

        const shorthand = resolveRoot('div { transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1); }')
        assert.equal(shorthand.transitionProperty, 'color')
        assert.equal(shorthand.transitionTimingFunction, 'cubic-bezier(0.4, 0, 0.2, 1)')
    })

    it('defaults transition-timing-function to ease per spec', () => {
        const style = resolveRoot('div { transition: color 0.3s; }')
        assert.equal(style.transitionTimingFunction, 'ease')
    })
})
