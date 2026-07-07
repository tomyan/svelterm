/**
 * Screen domain — frame synchronisation and snapshots of the displayed
 * cell buffer over the debug protocol. `settle` is the scenario
 * harness's convergence point: it resolves once no render is scheduled
 * and the render queue is empty, yielding through macrotasks so
 * microtask-queued renders get to run first.
 */

import type { DebugDomain } from './server.js'
import type { CellBuffer } from '../render/buffer.js'
import { bufferToText, bufferToStyledText } from '../render/snapshot.js'

/** Live render-loop state the domain reads from mount(). */
export interface ScreenHooks {
    /** The frame as displayed (post-diff base), or null before first paint. */
    displayBuffer(): CellBuffer | null
    /** True while a render is scheduled or queued work remains. */
    renderPending(): boolean
}

const DEFAULT_SETTLE_TIMEOUT_MS = 2000

export class ScreenDomain implements DebugDomain {
    constructor(private hooks: ScreenHooks) {}

    handle(method: string, params: Record<string, any>): any {
        switch (method) {
            case 'text': return this.snapshot(bufferToText)
            case 'styled': return this.snapshot(bufferToStyledText)
            case 'cell': return this.cell(params.x, params.y)
            case 'settle': return this.settle(params.timeoutMs ?? DEFAULT_SETTLE_TIMEOUT_MS)
            default: throw new Error(`Unknown Screen method: ${method}`)
        }
    }

    private buffer(): CellBuffer {
        const buffer = this.hooks.displayBuffer()
        if (!buffer) throw new Error('No frame painted yet')
        return buffer
    }

    private snapshot(serialise: (buffer: CellBuffer) => string) {
        const buffer = this.buffer()
        return { text: serialise(buffer), width: buffer.width, height: buffer.height }
    }

    private cell(x: number, y: number) {
        const buffer = this.buffer()
        const cell = buffer.getCell(x, y)
        if (!cell) throw new Error(`Cell (${x}, ${y}) is out of bounds for ${buffer.width}x${buffer.height}`)
        return { ...cell }
    }

    private async settle(timeoutMs: number): Promise<Record<string, never>> {
        const deadline = Date.now() + timeoutMs
        while (true) {
            // A macrotask hop lets microtask-scheduled renders run first
            await new Promise(resolve => setTimeout(resolve, 0))
            if (!this.hooks.renderPending()) return {}
            if (Date.now() > deadline) throw new Error(`Screen.settle timed out after ${timeoutMs}ms`)
        }
    }
}
