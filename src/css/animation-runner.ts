import type { KeyframeStop, CSSDeclaration } from './parser.js'
import type { ResolvedStyle } from './compute.js'
import { resolveColor } from './color.js'
import { lerpColor } from './interpolate.js'

/**
 * Runs a CSS animation by applying keyframe properties at the current
 * time. Colours interpolate in RGB space between stops; properties that
 * cannot mix (booleans, `default` colours) switch discretely at the
 * segment midpoint, matching CSS's rule for non-interpolable values.
 */
export class AnimationRunner {
    private keyframes: KeyframeStop[]
    private duration: number
    private iterations: number

    constructor(keyframes: KeyframeStop[], durationMs: number, iterations: number) {
        this.keyframes = keyframes.sort((a, b) => a.offset - b.offset)
        this.duration = durationMs
        this.iterations = iterations
    }

    /** Apply the animation's state at the given elapsed time to a style */
    apply(style: ResolvedStyle, elapsedMs: number): void {
        if (this.keyframes.length === 0 || this.duration <= 0) return

        const progress = this.getProgress(elapsedMs)
        const { from, to, localT } = this.segmentAt(progress)

        // Hold the earlier stop's values, then interpolate toward the next
        for (const decl of from.declarations) {
            applyAnimatedProperty(style, decl)
        }
        if (!to) return
        for (const decl of to.declarations) {
            const fromDecl = from.declarations.find(d => d.property === decl.property)
            if (fromDecl) {
                applyInterpolatedProperty(style, fromDecl, decl, localT)
            } else if (localT >= 0.5) {
                applyAnimatedProperty(style, decl)
            }
        }
    }

    isFinished(elapsedMs: number): boolean {
        if (this.iterations === Infinity) return false
        return elapsedMs >= this.duration * this.iterations
    }

    private getProgress(elapsedMs: number): number {
        if (this.iterations === Infinity) {
            return (elapsedMs % this.duration) / this.duration
        }
        const totalDuration = this.duration * this.iterations
        if (elapsedMs >= totalDuration) return 1 // finished — hold at end
        return (elapsedMs % this.duration) / this.duration
    }

    /** The keyframe pair bracketing `progress`, with position inside that segment. */
    private segmentAt(progress: number): { from: KeyframeStop; to: KeyframeStop | null; localT: number } {
        let index = 0
        for (let i = 0; i < this.keyframes.length; i++) {
            if (this.keyframes[i].offset <= progress) index = i
            else break
        }
        const from = this.keyframes[index]
        const to = this.keyframes[index + 1] ?? null
        if (!to) return { from, to: null, localT: 0 }
        const span = to.offset - from.offset
        const localT = span > 0 ? (progress - from.offset) / span : 1
        return { from, to, localT }
    }
}

function applyAnimatedProperty(style: ResolvedStyle, decl: CSSDeclaration): void {
    switch (decl.property) {
        case 'color': style.fg = resolveColor(decl.value); break
        case 'background-color': case 'background': style.bg = resolveColor(decl.value); break
        case 'font-weight': style.bold = decl.value === 'bold' || parseInt(decl.value) >= 700; break
        case 'font-style': style.italic = decl.value === 'italic'; break
        case 'opacity': style.dim = decl.value === 'dim' || (parseFloat(decl.value) < 1); break
    }
}

function applyInterpolatedProperty(
    style: ResolvedStyle, from: CSSDeclaration, to: CSSDeclaration, t: number,
): void {
    switch (to.property) {
        case 'color': {
            const mixed = lerpColor(resolveColor(from.value), resolveColor(to.value), t)
            if (mixed !== null) { style.fg = mixed; return }
            break
        }
        case 'background-color': case 'background': {
            const mixed = lerpColor(resolveColor(from.value), resolveColor(to.value), t)
            if (mixed !== null) { style.bg = mixed; return }
            break
        }
    }
    // Non-interpolable (booleans, default colours): discrete at the midpoint
    applyAnimatedProperty(style, t >= 0.5 ? to : from)
}
