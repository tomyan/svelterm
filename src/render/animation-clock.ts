import { TermNode } from '../renderer/node.js'
import { AnimationRunner } from '../css/animation-runner.js'
import { resolveKeyframeStops, type KeyframeResolution } from '../css/animation.js'
import { parseEasing, type Easing } from '../css/easing.js'
import type { KeyframeStop, CSSDeclaration } from '../css/parser.js'
import type { ResolvedStyle } from '../css/compute.js'
import { systemClock, clockFromNow, type Clock, type ClockTimer } from './clock.js'

export type { KeyframeResolution } from '../css/animation.js'

/** The runner's easing for a CSS timing-function value; invalid → linear. */
function easingFor(value: string): Easing {
    return parseEasing(value) ?? (t => t)
}

function cellValue(value: number | string | null): string | null {
    return typeof value === 'number' && value >= 0 ? `${value}cell` : null
}

/** Properties transitions can animate, read from the resolved style as CSS values. */
const TRANSITIONABLE: { css: string; read: (s: ResolvedStyle) => string | null }[] = [
    { css: 'color', read: s => s.fg },
    { css: 'background-color', read: s => s.bg },
    { css: 'width', read: s => cellValue(s.width) },
    { css: 'height', read: s => cellValue(s.height) },
    { css: 'padding-top', read: s => cellValue(s.paddingTop) },
    { css: 'padding-right', read: s => cellValue(s.paddingRight) },
    { css: 'padding-bottom', read: s => cellValue(s.paddingBottom) },
    { css: 'padding-left', read: s => cellValue(s.paddingLeft) },
    { css: 'margin-top', read: s => cellValue(s.marginTop) },
    { css: 'margin-right', read: s => cellValue(s.marginRight) },
    { css: 'margin-bottom', read: s => cellValue(s.marginBottom) },
    { css: 'margin-left', read: s => cellValue(s.marginLeft) },
    { css: 'gap', read: s => cellValue(s.gap) },
    { css: 'top', read: s => cellValue(s.top) },
    { css: 'right', read: s => cellValue(s.right) },
    { css: 'bottom', read: s => cellValue(s.bottom) },
    { css: 'left', read: s => cellValue(s.left) },
]

/** Repaint cadence while animations run — colours interpolate, so ~30fps. */
const FRAME_INTERVAL_MS = 33

interface ActiveAnimation {
    node: TermNode
    runner: AnimationRunner
    name: string
    duration: number
    start: number
    /** Fingerprint of var()/light-dark()-resolved stops, for retargeting. */
    resolvedKey?: string
}

/**
 * Drives CSS animations: discovers animated elements after style
 * resolution, applies the current keyframe onto their resolved styles,
 * and ticks a frame timer while any animation is live. The consumer
 * wires `onFrame` to re-apply and repaint.
 */
export class AnimationClock {
    private active = new Map<number, ActiveAnimation>()
    /** Per-property transition runners, keyed `nodeId:property`. */
    private transitions = new Map<string, ActiveAnimation>()
    /** Last-seen target values per transitioned node, as CSS property → value. */
    private transitionTargets = new Map<number, Record<string, string>>()
    private timer: ClockTimer | null = null
    private clock: Clock
    onFrame?: () => void

    /**
     * Accepts a Clock (time source + scheduler) or, for convenience and
     * backward compatibility, a bare `() => number` time function.
     */
    constructor(clock: Clock | (() => number) = systemClock) {
        this.clock = typeof clock === 'function' ? clockFromNow(clock) : clock
    }

    private now(): number {
        return this.clock.now()
    }

    get activeCount(): number {
        return this.active.size + this.transitions.size
    }

    /** Whether this node's animation needs re-layout each frame (vs repaint only). */
    touchesLayout(node: TermNode): boolean {
        if (this.active.get(node.id)?.runner.touchesLayout) return true
        for (const anim of this.transitions.values()) {
            if (anim.node.id === node.id && anim.runner.touchesLayout) return true
        }
        return false
    }

    /**
     * Track transitioned elements and start a one-shot transition when a
     * tracked property's target value changed since the last sync. When
     * `resolvedIds` is given (incremental restyle), only subtrees rooted
     * at those nodes are compared — other nodes' styles may carry
     * mid-animation values that are not new targets.
     */
    syncTransitions(root: TermNode, styles: Map<number, ResolvedStyle>, resolvedIds?: Set<number>): void {
        const seen = new Set<number>()
        this.discoverTransitions(root, styles, resolvedIds === undefined, resolvedIds, seen)
        for (const id of this.transitionTargets.keys()) {
            if (!seen.has(id)) {
                this.transitionTargets.delete(id)
                for (const key of this.transitions.keys()) {
                    if (key.startsWith(`${id}:`)) this.transitions.delete(key)
                }
            }
        }
        this.updateTimer()
    }

    /** Reconcile active animations with the tree's current resolved styles. */
    sync(
        root: TermNode, styles: Map<number, ResolvedStyle>,
        keyframes: Map<string, KeyframeStop[]>, resolution?: KeyframeResolution,
    ): void {
        const seen = new Set<number>()
        this.discover(root, styles, keyframes, seen, resolution)
        for (const id of this.active.keys()) {
            if (!seen.has(id)) this.active.delete(id)
        }
        this.updateTimer()
    }

    /**
     * Apply the current animation state of each animation onto the styles
     * map. Returns the nodes touched, each flagged with whether it needs
     * re-layout; finished animations hold their final keyframe and are
     * pruned.
     */
    apply(styles: Map<number, ResolvedStyle>): { node: TermNode; touchesLayout: boolean }[] {
        const dirty: { node: TermNode; touchesLayout: boolean }[] = []
        this.applyEntries(this.active, styles, dirty)
        this.applyEntries(this.transitions, styles, dirty)
        this.updateTimer()
        return dirty
    }

    private applyEntries<K>(
        entries: Map<K, ActiveAnimation>,
        styles: Map<number, ResolvedStyle>,
        dirty: { node: TermNode; touchesLayout: boolean }[],
    ): void {
        for (const [key, anim] of entries) {
            const style = styles.get(anim.node.id)
            if (!style) continue
            const elapsed = this.now() - anim.start
            anim.runner.apply(style, elapsed)
            dirty.push({ node: anim.node, touchesLayout: anim.runner.touchesLayout })
            if (anim.runner.isFinished(elapsed)) entries.delete(key)
        }
    }

    stop(): void {
        if (this.timer !== null) {
            this.clock.clearInterval(this.timer)
            this.timer = null
        }
    }

    private discover(
        node: TermNode, styles: Map<number, ResolvedStyle>,
        keyframes: Map<string, KeyframeStop[]>, seen: Set<number>,
        resolution?: KeyframeResolution,
    ): void {
        if (node.nodeType === 'element') {
            const style = styles.get(node.id)
            const name = style?.animationName
            const stops = name ? keyframes.get(name) : undefined
            if (style && name && stops && style.animationDuration > 0) {
                const existing = this.active.get(node.id)
                const resolved = resolution
                    ? resolveKeyframeStops(stops, resolution, node.id)
                    : stops
                const resolvedKey = JSON.stringify(resolved)
                if (!existing || existing.name !== name || existing.duration !== style.animationDuration) {
                    this.active.set(node.id, {
                        node,
                        runner: new AnimationRunner(
                            resolved, style.animationDuration, style.animationIterationCount,
                            easingFor(style.animationTimingFunction)),
                        name,
                        duration: style.animationDuration,
                        start: this.now(),
                        resolvedKey,
                    })
                } else if (existing.resolvedKey !== undefined && existing.resolvedKey !== resolvedKey) {
                    // var()/light-dark() re-resolved to new values (scheme
                    // flip, custom property change): retarget the runner
                    // without restarting — the original start time holds.
                    existing.runner = new AnimationRunner(
                        resolved, style.animationDuration, style.animationIterationCount,
                        easingFor(style.animationTimingFunction))
                    existing.resolvedKey = resolvedKey
                }
                seen.add(node.id)
            }
        }
        for (const child of node.children) this.discover(child, styles, keyframes, seen, resolution)
    }

    private discoverTransitions(
        node: TermNode, styles: Map<number, ResolvedStyle>,
        parentResolved: boolean, resolvedIds: Set<number> | undefined, seen: Set<number>,
    ): void {
        const subtreeResolved = parentResolved || (resolvedIds?.has(node.id) ?? false)
        if (node.nodeType === 'element') {
            const style = styles.get(node.id)
            if (style && style.transitions.some(t => t.duration > 0)) {
                seen.add(node.id)
                if (subtreeResolved) this.trackTransitionTargets(node, style)
            }
        }
        for (const child of node.children) {
            this.discoverTransitions(child, styles, subtreeResolved, resolvedIds, seen)
        }
    }

    /**
     * Snapshot the node's target values; start a per-property transition
     * runner on any change, each with its own duration and timing. An
     * interrupted transition continues from its current blended value
     * rather than restarting from the previous target.
     */
    private trackTransitionTargets(node: TermNode, style: ResolvedStyle): void {
        const configFor = (css: string) =>
            style.transitions.find(t => t.property === css
                || (t.property === 'background' && css === 'background-color'))
            ?? style.transitions.find(t => t.property === 'all')

        const targets: Record<string, string> = {}
        for (const prop of TRANSITIONABLE) {
            const config = configFor(prop.css)
            if (!config || config.duration <= 0) continue
            const value = prop.read(style)
            if (value !== null) targets[prop.css] = value
        }
        const previous = this.transitionTargets.get(node.id)
        this.transitionTargets.set(node.id, targets)
        if (!previous) return // first sight — the initial style never transitions

        for (const [property, target] of Object.entries(targets)) {
            const before = previous[property]
            if (before === undefined || before === target) continue
            const config = configFor(property)!
            const key = `${node.id}:${property}`

            // Interrupted mid-flight? Continue from the current value.
            let from = before
            const inFlight = this.transitions.get(key)
            if (inFlight) {
                const current = this.currentValue(inFlight, style, property)
                if (current !== null) from = current
            }

            const stops: KeyframeStop[] = [
                { offset: 0, declarations: [{ property, value: from }] },
                { offset: 1, declarations: [{ property, value: target }] },
            ]
            this.transitions.set(key, {
                node,
                runner: new AnimationRunner(stops, config.duration, 1,
                    easingFor(config.timing)),
                name: property,
                duration: config.duration,
                start: this.now(),
            })
        }
    }

    /** Evaluate an in-flight transition's value for one property, now. */
    private currentValue(anim: ActiveAnimation, base: ResolvedStyle, property: string): string | null {
        const scratch: ResolvedStyle = { ...base }
        anim.runner.apply(scratch, this.now() - anim.start)
        return TRANSITIONABLE.find(p => p.css === property)?.read(scratch) ?? null
    }

    private updateTimer(): void {
        if (this.activeCount > 0 && this.timer === null) {
            this.timer = this.clock.setInterval(() => this.onFrame?.(), FRAME_INTERVAL_MS)
        } else if (this.activeCount === 0) {
            this.stop()
        }
    }
}
