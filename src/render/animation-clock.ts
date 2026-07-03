import { TermNode } from '../renderer/node.js'
import { AnimationRunner } from '../css/animation-runner.js'
import type { KeyframeStop } from '../css/parser.js'
import type { ResolvedStyle } from '../css/compute.js'

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
    private timer: ReturnType<typeof setInterval> | null = null
    onFrame?: () => void

    constructor(private now: () => number = Date.now) {}

    get activeCount(): number {
        return this.active.size
    }

    /** Whether this node's animation needs re-layout each frame (vs repaint only). */
    touchesLayout(node: TermNode): boolean {
        return this.active.get(node.id)?.runner.touchesLayout ?? false
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
        for (const [id, anim] of this.active) {
            const style = styles.get(id)
            if (!style) continue
            const elapsed = this.now() - anim.start
            anim.runner.apply(style, elapsed)
            dirty.push({ node: anim.node, touchesLayout: anim.runner.touchesLayout })
            if (anim.runner.isFinished(elapsed)) this.active.delete(id)
        }
        this.updateTimer()
        return dirty
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
                        runner: new AnimationRunner(stops, style.animationDuration, style.animationIterationCount),
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

    private updateTimer(): void {
        if (this.active.size > 0 && this.timer === null) {
            this.timer = setInterval(() => this.onFrame?.(), FRAME_INTERVAL_MS)
        } else if (this.active.size === 0) {
            this.stop()
        }
    }
}
