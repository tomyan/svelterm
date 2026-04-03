import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { createTermRenderer, TermNode } from './renderer/index.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles } from './css/compute.js'
import { computeLayout } from './layout/engine.js'
import { parseKeyEvent } from './input/keyboard.js'
import { FocusManager } from './input/focus.js'
import { dispatchEvent } from './input/dispatch.js'
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
    const stylesheet = options?.css ? parseCSS(options.css) : null

    const renderer = createTermRenderer()
    const root = new TermNode('element', 'root')
    let prevBuffer: CellBuffer | null = null
    let renderScheduled = false

    const scheduleRender = () => {
        if (renderScheduled) return
        renderScheduled = true
        queueMicrotask(() => {
            renderScheduled = false
            render()
        })
    }

    const render = () => {
        const size = getTerminalSize()
        const buffer = new CellBuffer(size.width, size.height)
        const styles = stylesheet ? resolveStyles(root, stylesheet) : undefined
        const layout = styles ? computeLayout(root, styles, size.width, size.height) : undefined
        paint(root, buffer, styles, layout)
        const output = diffBuffers(prevBuffer, buffer)
        if (output.length > 0) writeOutput(output)
        prevBuffer = buffer
    }

    const focusManager = new FocusManager()

    // Re-render when tree mutates, auto-register focusable elements
    const origInsert = root.insertBefore.bind(root)
    root.insertBefore = (node: TermNode, anchor: TermNode | null) => {
        origInsert(node, anchor)
        registerFocusableNodes(node, focusManager)
        scheduleRender()
    }

    if (fullscreen) enterFullscreen()
    enableRawMode()

    const { unmount: svUnmount } = renderer.render(
        AppComponent as any,
        { target: root, props: (options as any)?.props ?? {} },
    )
    const cleanup = createCleanup(svUnmount, fullscreen)
    setupInputHandlers(scheduleRender, cleanup, focusManager)
    setupResizeHandler(scheduleRender, () => { prevBuffer = null })
    scheduleRender()

    return cleanup
}

function createCleanup(unmountComponent: () => void, fullscreen: boolean): () => void {
    let cleaned = false
    return () => {
        if (cleaned) return
        cleaned = true
        unmountComponent()
        disableRawMode()
        if (fullscreen) exitFullscreen()
    }
}

function setupInputHandlers(scheduleRender: () => void, cleanup: () => void, focusManager: FocusManager): void {
    process.stdin.on('data', (data: Buffer) => {
        const key = parseKeyEvent(data)
        if (!key) return

        if (key.ctrl && key.key === 'c') {
            cleanup()
            process.exit(0)
        }

        if (key.key === 'Tab') {
            focusManager.focusNext()
            scheduleRender()
            return
        }

        if (key.key === 'Enter' && focusManager.focused) {
            dispatchEvent(focusManager.focused, 'click')
            scheduleRender()
            return
        }

        if (focusManager.focused) {
            dispatchEvent(focusManager.focused, 'keydown', key)
            scheduleRender()
        }
    })

    process.on('SIGINT', () => { cleanup(); process.exit(0) })
    process.on('SIGTERM', () => { cleanup(); process.exit(0) })
}

function setupResizeHandler(scheduleRender: () => void, clearBuffer: () => void): void {
    process.stdout.on('resize', () => {
        clearBuffer()
        scheduleRender()
    })
}

const FOCUSABLE_TAGS = new Set(['button', 'input', 'textarea', 'a', 'select'])

function registerFocusableNodes(node: TermNode, focusManager: FocusManager): void {
    if (node.nodeType === 'element' && FOCUSABLE_TAGS.has(node.tag ?? '')) {
        focusManager.register(node)
    }
    for (const child of node.children) {
        registerFocusableNodes(child, focusManager)
    }
}

export { TermNode } from './renderer/node.js'
export { CellBuffer } from './render/buffer.js'
export { parseCSS } from './css/parser.js'
export { resolveStyles } from './css/compute.js'
