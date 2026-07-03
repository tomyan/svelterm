import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationClock } from '../src/render/animation-clock.js'
import { parseCSS } from '../src/css/parser.js'
import { getKeyframes } from '../src/css/animation.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

const PULSE_CSS = `
@keyframes pulse { 0% { color: red; } 50% { color: blue; } }
.pulse { animation: pulse 1s infinite; }
`

function makeAnimatedTree(css: string, className: string) {
    const root = new TermNode('element', 'root')
    const el = new TermNode('element', 'div')
    el.attributes.set('class', className)
    root.insertBefore(el, null)
    const sheet = parseCSS(css)
    const styles = resolveStyles(root, sheet)
    return { root, el, styles, keyframes: getKeyframes(sheet) }
}

describe('AnimationClock', () => {

    it('discovers an animated element on sync', () => {
        // Given
        const { root, styles, keyframes } = makeAnimatedTree(PULSE_CSS, 'pulse')
        const clock = new AnimationClock(() => 0)

        // When
        clock.sync(root, styles, keyframes)
        clock.stop()

        // Then
        assert.equal(clock.activeCount, 1)
    })

    it('ignores elements whose animation has no keyframes', () => {
        // Given
        const { root, styles, keyframes } = makeAnimatedTree('.pulse { animation: missing 1s infinite; }', 'pulse')
        const clock = new AnimationClock(() => 0)

        // When
        clock.sync(root, styles, keyframes)
        clock.stop()

        // Then
        assert.equal(clock.activeCount, 0)
    })

    it('applies the first keyframe at time zero', () => {
        // Given
        const { root, el, styles, keyframes } = makeAnimatedTree(PULSE_CSS, 'pulse')
        const clock = new AnimationClock(() => 0)
        clock.sync(root, styles, keyframes)

        // When
        const dirty = clock.apply(styles)
        clock.stop()

        // Then
        assert.equal(styles.get(el.id)?.fg, 'red')
        assert.deepEqual(dirty.map(node => node.id), [el.id])
    })

    it('advances to the next keyframe as time passes', () => {
        // Given
        let now = 0
        const { root, el, styles, keyframes } = makeAnimatedTree(PULSE_CSS, 'pulse')
        const clock = new AnimationClock(() => now)
        clock.sync(root, styles, keyframes)

        // When
        now = 600
        clock.apply(styles)
        clock.stop()

        // Then
        assert.equal(styles.get(el.id)?.fg, 'blue')
    })

    it('keeps the start time across re-syncs so animations do not restart', () => {
        // Given
        let now = 0
        const { root, el, styles, keyframes } = makeAnimatedTree(PULSE_CSS, 'pulse')
        const clock = new AnimationClock(() => now)
        clock.sync(root, styles, keyframes)

        // When
        now = 600
        clock.sync(root, styles, keyframes)
        clock.apply(styles)
        clock.stop()

        // Then
        assert.equal(styles.get(el.id)?.fg, 'blue')
    })

    it('prunes finished animations and stops reporting them active', () => {
        // Given
        let now = 0
        const css = '@keyframes once { 0% { color: red; } 50% { color: blue; } } .x { animation: once 1s; }'
        const { root, styles, keyframes } = makeAnimatedTree(css, 'x')
        const clock = new AnimationClock(() => now)
        clock.sync(root, styles, keyframes)

        // When
        now = 1500
        clock.apply(styles)
        clock.stop()

        // Then
        assert.equal(clock.activeCount, 0)
    })

    it('drops elements that no longer animate after a re-sync', () => {
        // Given
        const { root, el, styles, keyframes } = makeAnimatedTree(PULSE_CSS, 'pulse')
        const clock = new AnimationClock(() => 0)
        clock.sync(root, styles, keyframes)

        // When
        const style = styles.get(el.id)!
        style.animationName = null
        clock.sync(root, styles, keyframes)
        clock.stop()

        // Then
        assert.equal(clock.activeCount, 0)
    })
})
