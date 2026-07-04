import { TermNode } from '../renderer/node.js'
import { AnimationRunner } from '../css/animation-runner.js'
import { parseEasing, type Easing } from '../css/easing.js'
import type { KeyframeStop, CSSDeclaration } from '../css/parser.js'
import type { ResolvedStyle } from '../css/compute.js'

/** The runner's easing for a CSS timing-function value; invalid → linear. */
function easingFor(value: string): Easing {
    return parseEasing(value) ?? (t => t)
}

/** Parse a transition-property value into the tracked-property filter. */
function transitionedProperties(value: string): { all: boolean; names: Set<string> } {
    const names = new Set<string>()
    for (const raw of value.split(',')) {
        const name = raw.trim()
        if (name === 'all') return { all: true, names }
        names.add(name === 'background' ? 'background-color' : name)
    }
    return { all: false, names }
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
}

/**
 * Drives CSS animations: discovers animated elements after style
 * resolution, applies the current keyframe onto their resolved styles,
 * and ticks a frame timer while any animation is live. The consumer
 * wires `onFrame` to re-apply and repaint.
 */
export class AnimationClock {
    private active = new Map<number, ActiveAnimation>()
    private transitions = new Map<number, ActiveAnimation>()
    /** Last-seen target values per transitioned node, as CSS property → value. */
    private transitionTargets = new Map<number, Record<string, string>>()
    private timer: ReturnType<typeof setInterval> | null = null
    onFrame?: () => void

    constructor(private now: () => number = Date.now) {}

    get activeCount(): number {
        return this.active.size + this.transitions.size
    }

    /** Whether this node's animation needs re-layout each frame (vs repaint only). */
    touchesLayout(node: TermNode): boolean {
        return (this.active.get(node.id)?.runner.touchesLayout
            || this.transitions.get(node.id)?.runner.touchesLayout) ?? false
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
                this.transitions.delete(id)
            }
        }
        this.updateTimer()
    }

    /** Reconcile active animations with the tree's current resolved styles. */
    sync(root: TermNode, styles: Map<number, ResolvedStyle>, keyframes: Map<string, KeyframeStop[]>): void {
        const seen = new Set<number>()
        this.discover(root, styles, keyframes, seen)
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

    private applyEntries(
        entries: Map<number, ActiveAnimation>,
        styles: Map<number, ResolvedStyle>,
        dirty: { node: TermNode; touchesLayout: boolean }[],
    ): void {
        for (const [id, anim] of entries) {
            const style = styles.get(id)
            if (!style) continue
            const elapsed = this.now() - anim.start
            anim.runner.apply(style, elapsed)
            dirty.push({ node: anim.node, touchesLayout: anim.runner.touchesLayout })
            if (anim.runner.isFinished(elapsed)) entries.delete(id)
        }
    }

    stop(): void {
        if (this.timer !== null) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    private discover(
        node: TermNode, styles: Map<number, ResolvedStyle>,
        keyframes: Map<string, KeyframeStop[]>, seen: Set<number>,
    ): void {
        if (node.nodeType === 'element') {
            const style = styles.get(node.id)
            const name = style?.animationName
            const stops = name ? keyframes.get(name) : undefined
            if (style && name && stops && style.animationDuration > 0) {
                const existing = this.active.get(node.id)
                if (!existing || existing.name !== name || existing.duration !== style.animationDuration) {
                    this.active.set(node.id, {
                        node,
                        runner: new AnimationRunner(
                            stops, style.animationDuration, style.animationIterationCount,
                            easingFor(style.animationTimingFunction)),
                        name,
                        duration: style.animationDuration,
                        start: this.now(),
                    })
                }
                seen.add(node.id)
            }
        }
        for (const child of node.children) this.discover(child, styles, keyframes, seen)
    }

    private discoverTransitions(
        node: TermNode, styles: Map<number, ResolvedStyle>,
        parentResolved: boolean, resolvedIds: Set<number> | undefined, seen: Set<number>,
    ): void {
        const subtreeResolved = parentResolved || (resolvedIds?.has(node.id) ?? false)
        if (node.nodeType === 'element') {
            const style = styles.get(node.id)
            if (style?.transitionProperty && style.transitionDuration > 0) {
                seen.add(node.id)
                if (subtreeResolved) this.trackTransitionTargets(node, style)
            }
        }
        for (const child of node.children) {
            this.discoverTransitions(child, styles, subtreeResolved, resolvedIds, seen)
        }
    }

    /** Snapshot the node's target values; start a transition on any change. */
    private trackTransitionTargets(node: TermNode, style: ResolvedStyle): void {
        const included = transitionedProperties(style.transitionProperty!)
        const targets: Record<string, string> = {}
        for (const prop of TRANSITIONABLE) {
            if (!included.all && !included.names.has(prop.css)) continue
            const value = prop.read(style)
            if (value !== null) targets[prop.css] = value
        }
        const previous = this.transitionTargets.get(node.id)
        this.transitionTargets.set(node.id, targets)
        if (!previous) return // first sight — the initial style never transitions

        const fromDecls: CSSDeclaration[] = []
        const toDecls: CSSDeclaration[] = []
        for (const [property, target] of Object.entries(targets)) {
            const before = previous[property]
            if (before !== undefined && before !== target) {
                fromDecls.push({ property, value: before })
                toDecls.push({ property, value: target })
            }
        }
        if (fromDecls.length === 0) return
        const stops: KeyframeStop[] = [
            { offset: 0, declarations: fromDecls },
            { offset: 1, declarations: toDecls },
        ]
        this.transitions.set(node.id, {
            node,
            runner: new AnimationRunner(stops, style.transitionDuration, 1,
                easingFor(style.transitionTimingFunction)),
            name: '',
            duration: style.transitionDuration,
            start: this.now(),
        })
    }

    private updateTimer(): void {
        if (this.activeCount > 0 && this.timer === null) {
            this.timer = setInterval(() => this.onFrame?.(), FRAME_INTERVAL_MS)
        } else if (this.activeCount === 0) {
            this.stop()
        }
    }
}
