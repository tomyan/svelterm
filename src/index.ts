import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { createTermRenderer, TermNode } from './renderer/index.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles } from './css/compute.js'
import { computeLayout } from './layout/engine.js'
import { parseKeyEvent } from './input/keyboard.js'
import { parseMouseEvent } from './input/mouse.js'
import { hitTest } from './input/hit.js'
import { FocusManager } from './input/focus.js'
import { dispatchEvent } from './input/dispatch.js'
import type { CSSStyleSheet } from './css/parser.js'
import * as ansi from './render/ansi.js'
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
    mouse?: boolean
}

export function mount<Props extends Record<string, any>>(
    AppComponent: ComponentType<SvelteComponent<Props>> | Component<Props>,
    options?: MountOptions & ({} extends Props ? { props?: Props } : { props: Props }),
): () => void {
    const fullscreen = options?.fullscreen ?? true
    const mouseEnabled = options?.mouse ?? false
    const stylesheet = options?.css ? parseCSS(options.css) : null
    let lastLayout: Map<number, import('./layout/engine.js').LayoutBox> | undefined

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
        lastLayout = layout
        paint(root, buffer, styles, layout)
        const output = diffBuffers(prevBuffer, buffer)
        if (output.length > 0) writeOutput(output)
        prevBuffer = buffer
    }

    const focusManager = new FocusManager()

    // Pass root and layout to input handler for mouse hit testing
    const getRoot = () => root
    const getLayout = () => lastLayout

    // Re-render when tree mutates, auto-register focusable elements
    const origInsert = root.insertBefore.bind(root)
    root.insertBefore = (node: TermNode, anchor: TermNode | null) => {
        origInsert(node, anchor)
        registerFocusableNodes(node, focusManager)
        scheduleRender()
    }

    if (fullscreen) enterFullscreen()
    if (mouseEnabled) writeOutput(ansi.enableMouse())
    enableRawMode()

    const { unmount: svUnmount } = renderer.render(
        AppComponent as any,
        { target: root, props: (options as any)?.props ?? {} },
    )
    const cleanup = createCleanup(svUnmount, fullscreen, mouseEnabled)
    setupInputHandlers(scheduleRender, cleanup, focusManager, getRoot, getLayout)
    setupResizeHandler(scheduleRender, () => { prevBuffer = null })
    scheduleRender()

    return cleanup
}

function createCleanup(unmountComponent: () => void, fullscreen: boolean, mouseEnabled: boolean): () => void {
    let cleaned = false
    return () => {
        if (cleaned) return
        cleaned = true
        unmountComponent()
        if (mouseEnabled) writeOutput(ansi.disableMouse())
        disableRawMode()
        if (fullscreen) exitFullscreen()
    }
}

function setupInputHandlers(
    scheduleRender: () => void,
    cleanup: () => void,
    focusManager: FocusManager,
    getRoot: () => TermNode,
    getLayout: () => Map<number, import('./layout/engine.js').LayoutBox> | undefined,
): void {
    process.stdin.on('data', (data: Buffer) => {
        // Try mouse first
        const mouse = parseMouseEvent(data)
        if (mouse) {
            handleMouse(mouse, getRoot(), getLayout(), focusManager, scheduleRender)
            return
        }

        const key = parseKeyEvent(data)
        if (!key) return

        if (key.ctrl && key.key === 'c') {
            cleanup()
            process.exit(0)
        }

        if (key.key === 'Tab' && key.shift) {
            focusManager.focusPrevious()
            scheduleRender()
            return
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

function handleMouse(
    mouse: import('./input/mouse.js').MouseEvent,
    root: TermNode,
    layout: Map<number, import('./layout/engine.js').LayoutBox> | undefined,
    focusManager: FocusManager,
    scheduleRender: () => void,
): void {
    if (!layout || mouse.type !== 'press') return

    if (mouse.button === 'left') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            dispatchEvent(target, 'click', mouse)
            scheduleRender()
        }
    } else if (mouse.button === 'scrollUp' || mouse.button === 'scrollDown') {
        const target = hitTest(root, layout, mouse.col, mouse.row)
        if (target) {
            dispatchEvent(target, 'scroll', mouse)
            scheduleRender()
        }
    }
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
