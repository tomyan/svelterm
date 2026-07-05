/**
 * Clock seam for time-driven rendering (animations, transitions, and the
 * scrollbar fade). Abstracts both the time source and the frame
 * scheduler so tests can advance time and fire ticks deterministically
 * instead of depending on `Date.now()` and real `setInterval`.
 */

export type ClockTimer = unknown

export interface Clock {
    now(): number
    setInterval(fn: () => void, ms: number): ClockTimer
    clearInterval(timer: ClockTimer): void
}

/** The real clock: wall time and the platform timer. */
export const systemClock: Clock = {
    now: () => Date.now(),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
}

/** Wrap a bare time function in a Clock backed by the real scheduler. */
export function clockFromNow(now: () => number): Clock {
    return { now, setInterval: systemClock.setInterval, clearInterval: systemClock.clearInterval }
}

interface TestTimer {
    fn: () => void
    ms: number
    /** Absolute time of the next fire. */
    next: number
}

/**
 * A controllable clock for tests: set the time directly, or `advance`
 * it, which fires any registered intervals at each tick they cross.
 */
export class TestClock implements Clock {
    private time: number
    private timers = new Set<TestTimer>()

    constructor(start = 0) {
        this.time = start
    }

    now(): number {
        return this.time
    }

    setInterval(fn: () => void, ms: number): ClockTimer {
        const timer: TestTimer = { fn, ms, next: this.time + ms }
        this.timers.add(timer)
        return timer
    }

    clearInterval(timer: ClockTimer): void {
        this.timers.delete(timer as TestTimer)
    }

    /** Jump to an absolute time without firing intervals. */
    setTime(time: number): void {
        this.time = time
    }

    /** Advance by `ms`, firing each interval at every tick it crosses. */
    advance(ms: number): void {
        const target = this.time + ms
        while (true) {
            const due = this.nextTimerBefore(target)
            if (!due) break
            this.time = due.next
            due.next += due.ms
            due.fn()
        }
        this.time = target
    }

    /** Timers registered right now (for assertions). */
    get activeTimers(): number {
        return this.timers.size
    }

    private nextTimerBefore(target: number): TestTimer | null {
        let earliest: TestTimer | null = null
        for (const timer of this.timers) {
            if (timer.next <= target && (!earliest || timer.next < earliest.next)) earliest = timer
        }
        return earliest
    }
}
