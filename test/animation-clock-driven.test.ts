import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AnimationClock } from '../src/render/animation-clock.js'
import { TestClock } from '../src/render/clock.js'
import { getKeyframes } from '../src/css/animation.js'
import { parseCSS } from '../src/css/parser.js'
import { resolveStyles } from '../src/css/compute.js'
import { TermNode } from '../src/renderer/node.js'

/**
 * Drive the animation clock's *frame scheduler* deterministically with a
 * TestClock — previously only the apply() logic was testable, never the
 * setInterval-based tick lifecycle.
 */
function animatedTree() {
    const root = new TermNode('element', 'root')
    const el = new TermNode('element', 'div')
    el.attributes.set('class', 'box')
    root.insertBefore(el, null)
    const sheet = parseCSS(`
        .box { color: red; animation: fade 100ms linear; }
        @keyframes fade { from { color: red; } to { color: blue; } }
    `)
    return { root, el, sheet }
}

describe('AnimationClock frame scheduling (TestClock)', () => {

    it('starts a frame timer when an animation is active', () => {
        // Given
        const clock = new TestClock()
        const anim = new AnimationClock(clock)
        const { root, sheet } = animatedTree()
        const styles = resolveStyles(root, sheet)

        // When
        anim.sync(root, styles, getKeyframes(sheet))

        // Then: a repaint timer is scheduled
        assert.equal(clock.activeTimers, 1)
    })

    it('fires onFrame on each tick while animating', () => {
        // Given
        const clock = new TestClock()
        const anim = new AnimationClock(clock)
        let frames = 0
        anim.onFrame = () => { frames++ }
        const { root, sheet } = animatedTree()
        anim.sync(root, resolveStyles(root, sheet), getKeyframes(sheet))

        // When: advance ~3 frames (33ms cadence)
        clock.advance(100)

        // Then
        assert.ok(frames >= 3, `expected >= 3 frames, got ${frames}`)
    })

    it('stops the timer once the animation finishes', () => {
        // Given
        const clock = new TestClock()
        const anim = new AnimationClock(clock)
        const { root, el, sheet } = animatedTree()
        anim.onFrame = () => {
            // The consumer re-applies each frame; do that so it can finish
            anim.apply(resolveStyles(root, sheet))
        }
        anim.sync(root, resolveStyles(root, sheet), getKeyframes(sheet))
        assert.equal(clock.activeTimers, 1)

        // When: run past the 100ms animation
        clock.advance(200)

        // Then: no timer left running
        assert.equal(clock.activeTimers, 0)
        void el
    })
})
