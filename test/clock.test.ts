import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TestClock, clockFromNow } from '../src/render/clock.js'

describe('TestClock', () => {

    it('reports the time it is set to', () => {
        const clock = new TestClock(100)
        assert.equal(clock.now(), 100)
        clock.setTime(250)
        assert.equal(clock.now(), 250)
    })

    it('advance fires an interval at each tick it crosses', () => {
        // Given
        const clock = new TestClock()
        let ticks = 0
        clock.setInterval(() => { ticks++ }, 10)

        // When: advance 35ms over a 10ms interval
        clock.advance(35)

        // Then: fired at 10, 20, 30 — not yet 40
        assert.equal(ticks, 3)
        assert.equal(clock.now(), 35)
    })

    it('advance leaves the clock at the exact target time', () => {
        const clock = new TestClock()
        clock.setInterval(() => {}, 10)
        clock.advance(25)
        assert.equal(clock.now(), 25)
    })

    it('clearInterval stops further ticks', () => {
        // Given
        const clock = new TestClock()
        let ticks = 0
        const timer = clock.setInterval(() => { ticks++ }, 10)
        clock.advance(15)
        assert.equal(ticks, 1)

        // When
        clock.clearInterval(timer)
        clock.advance(50)

        // Then
        assert.equal(ticks, 1)
    })

    it('tracks active timers', () => {
        const clock = new TestClock()
        assert.equal(clock.activeTimers, 0)
        const t = clock.setInterval(() => {}, 5)
        assert.equal(clock.activeTimers, 1)
        clock.clearInterval(t)
        assert.equal(clock.activeTimers, 0)
    })
})

describe('clockFromNow', () => {

    it('uses the given time function', () => {
        let t = 7
        const clock = clockFromNow(() => t)
        assert.equal(clock.now(), 7)
        t = 42
        assert.equal(clock.now(), 42)
    })
})
