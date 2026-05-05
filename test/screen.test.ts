import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { enterFullscreen, exitFullscreen } from '../src/terminal/screen.js'
import * as ansi from '../src/render/ansi.js'
import type { TerminalIO } from '../src/terminal/io.js'

class CaptureIO implements TerminalIO {
    output = ''
    write(data: string): void { this.output += data }
    getSize(): { width: number; height: number } { return { width: 80, height: 24 } }
    onData(): void {}
    onResize(): void {}
    enableRawMode(): void {}
    disableRawMode(): void {}
    dispose(): void {}
}

describe('terminal/screen', () => {

    describe('enterFullscreen', () => {
        it('switches to alt screen and clears it', () => {
            // Given
            const io = new CaptureIO()

            // When
            enterFullscreen(io)

            // Then
            assert.ok(io.output.includes(ansi.enterAltScreen()), 'alt-screen sequence emitted')
            assert.ok(io.output.includes(ansi.clearScreen()), 'clear-screen sequence emitted')
        })

        it('does not emit hideCursor — cursor visibility is owned at the run level', () => {
            // Given
            const io = new CaptureIO()

            // When
            enterFullscreen(io)

            // Then
            assert.ok(!io.output.includes(ansi.hideCursor()),
                `enterFullscreen must not emit hideCursor; got ${JSON.stringify(io.output)}`)
        })
    })

    describe('exitFullscreen', () => {
        it('switches back to the main screen', () => {
            // Given
            const io = new CaptureIO()

            // When
            exitFullscreen(io)

            // Then
            assert.ok(io.output.includes(ansi.exitAltScreen()), 'exit-alt-screen sequence emitted')
        })

        it('does not emit showCursor — cursor visibility is owned at the run level', () => {
            // Given
            const io = new CaptureIO()

            // When
            exitFullscreen(io)

            // Then
            assert.ok(!io.output.includes(ansi.showCursor()),
                `exitFullscreen must not emit showCursor; got ${JSON.stringify(io.output)}`)
        })
    })
})
