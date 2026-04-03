import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { createTermRenderer, TermNode } from './renderer/index.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles } from './css/compute.js'
import { computeLayout } from './layout/engine.js'
import type { CSSStyleSheet } from './css/parser.js'
import {
    getTerminalSize,
    enterFullscreen,
    exitFullscreen,
    enableRawMode,
    disableRawMode,
    writeOutput,
} from './terminal/screen.js'

export interface MountOptions {
    fullscreen?: boolean
    css?: string
}

export function mount<Props extends Record<string, any>>(
    AppComponent: ComponentType<SvelteComponent<Props>> | Component<Props>,
    options?: MountOptions & ({} extends Props ? { props?: Props } : { props: Props }),
): () => void {
    const fullscreen = options?.fullscreen ?? true
    const renderer = createTermRenderer()
    const root = new TermNode('element', 'root')
    let prevBuffer: CellBuffer | null = null
    let unmountComponent: (() => void) | null = null
    let renderScheduled = false

    // Parse CSS if provided
    let stylesheet: CSSStyleSheet | null = null
    if (options?.css) {
        stylesheet = parseCSS(options.css)
    }

    function scheduleRender(): void {
        if (renderScheduled) return
        renderScheduled = true
        queueMicrotask(() => {
            renderScheduled = false
            renderToTerminal()
        })
    }

    function renderToTerminal(): void {
        const size = getTerminalSize()
        const buffer = new CellBuffer(size.width, size.height)

        // Resolve CSS styles and compute layout
        const styles = stylesheet ? resolveStyles(root, stylesheet) : undefined
        const layout = styles
            ? computeLayout(root, styles, size.width, size.height)
            : undefined

        paint(root, buffer, styles, layout)
        const output = diffBuffers(prevBuffer, buffer)
        if (output.length > 0) {
            writeOutput(output)
        }
        prevBuffer = buffer
    }

    // Patch root to trigger re-render on tree mutations
    const origInsert = root.insertBefore.bind(root)
    root.insertBefore = (node: TermNode, anchor: TermNode | null) => {
        origInsert(node, anchor)
        scheduleRender()
    }

    if (fullscreen) {
        enterFullscreen()
    }
    enableRawMode()

    // Mount the Svelte component into the virtual root
    const { unmount: svUnmount } = renderer.render(
        AppComponent as any,
        {
            target: root,
            props: (options as any)?.props ?? {},
        },
    )
    unmountComponent = svUnmount

    // Handle Ctrl+C
    process.stdin.on('data', (data: Buffer) => {
        if (data[0] === 0x03) {
            cleanup()
            process.exit(0)
        }
        scheduleRender()
    })

    // Handle resize
    process.stdout.on('resize', () => {
        prevBuffer = null
        scheduleRender()
    })

    function cleanup(): void {
        if (unmountComponent) {
            unmountComponent()
            unmountComponent = null
        }
        disableRawMode()
        if (fullscreen) {
            exitFullscreen()
        }
    }

    process.on('SIGINT', () => {
        cleanup()
        process.exit(0)
    })
    process.on('SIGTERM', () => {
        cleanup()
        process.exit(0)
    })

    // Initial render
    scheduleRender()

    return cleanup
}

export { TermNode } from './renderer/node.js'
export { CellBuffer } from './render/buffer.js'
export { parseCSS } from './css/parser.js'
export { resolveStyles } from './css/compute.js'
