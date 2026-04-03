import type { KeyframeStop, CSSDeclaration } from './parser.js'
import type { ResolvedStyle } from './compute.js'
import { resolveColor } from './color.js'
import { parseCellValue } from './values.js'

/**
 * Runs a CSS animation by applying keyframe properties at the current time.
 * Terminal animations are discrete (no interpolation between color values).
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

    /** Apply the appropriate keyframe declarations to a style at the given elapsed time */
    apply(style: ResolvedStyle, elapsedMs: number): void {
        if (this.keyframes.length === 0 || this.duration <= 0) return

        const progress = this.getProgress(elapsedMs)
        const kf = this.getKeyframeAt(progress)
        if (!kf) return

        for (const decl of kf.declarations) {
            applyAnimatedProperty(style, decl)
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

    private getKeyframeAt(progress: number): KeyframeStop | null {
        // Discrete: find the last keyframe whose offset <= progress
        let result: KeyframeStop | null = null
        for (const kf of this.keyframes) {
            if (kf.offset <= progress) result = kf
            else break
        }
        return result ?? this.keyframes[0]
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
