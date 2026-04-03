import type { Component, ComponentType, SvelteComponent } from 'svelte'
import { createTermRenderer, TermNode } from './renderer/index.js'
import { CellBuffer } from './render/buffer.js'
import { diffBuffers } from './render/diff.js'
import { paint } from './render/paint.js'
import { parseCSS } from './css/parser.js'
import { resolveStyles } from './css/compute.js'
import { resolveStylesIncremental } from './css/incremental.js'
import { computeLayout } from './layout/engine.js'
import { computeLayoutIncremental } from './layout/incremental.js'
import { RenderContext } from './render/context.js'
import { paintNodes } from './render/incremental-paint.js'
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

    // Render context tracks mutations and determines minimum work
    const ctx = new RenderContext()
    const renderer = createTermRenderer(ctx)
    const root = new TermNode('element', 'root')

    // Wire schedule callback (defined below, hoisted via closure)
    ctx.onScheduleRender = () => scheduleRender()

    // Persisted render state
    let prevBuffer: CellBuffer | null = null
    let lastStyles: Map<number, import('./css/compute.js').ResolvedStyle> | undefined
    let lastLayout: Map<number, import('./layout/engine.js').LayoutBox> | undefined
    let renderScheduled = false
    let initialRegistrationDone = false

    const scheduleRender = () => {
        if (renderScheduled) return
        renderScheduled = true
        queueMicrotask(() => {
            renderScheduled = false
            processQueue()
        })
    }


    const processQueue = () => {
        const snap = ctx.queue.snapshot()

        if (snap.fullRecompute || !lastStyles || !lastLayout) {
            // Full recompute — initial render, resize, or CSS reload
            fullRender()
        } else if (snap.paintOnly.size > 0 || snap.styleResolve.size > 0
            || snap.layoutSubtree.size > 0 || snap.layoutBubble.size > 0) {
            // Incremental render
            incrementalRender(snap)
        }
    }

    const fullRender = () => {
        const size = getTerminalSize()
        const buffer = new CellBuffer(size.width, size.height)
        lastStyles = stylesheet ? resolveStyles(root, stylesheet) : undefined
        lastLayout = lastStyles ? computeLayout(root, lastStyles, size.width, size.height) : undefined
        paint(root, buffer, lastStyles, lastLayout)
        const output = diffBuffers(prevBuffer, buffer)
        if (output.length > 0) writeOutput(output)
        prevBuffer = buffer

        // Register focusable elements and mutation callbacks after initial render
        if (!initialRegistrationDone) {
            registerFocusableNodes(root, focusManager)
            registerMutationCallbacks(root, ctx, scheduleRender)
            initialRegistrationDone = true
        }
    }

    const incrementalRender = (snap: import('./render/queue.js').RenderQueueSnapshot) => {
        const size = getTerminalSize()

        // Mutable copies for promoted nodes during processing
        const layoutSubtree = new Set(snap.layoutSubtree)
        const layoutBubble = new Set(snap.layoutBubble)

        // Step 1: Incremental style resolution
        if (snap.styleResolve.size > 0 && lastStyles && stylesheet) {
            lastStyles = resolveStylesIncremental(
                root, stylesheet, lastStyles, snap.styleResolve,
                undefined,
                (node) => { layoutSubtree.add(node) },
            )
        }

        // Step 2: Incremental layout
        if (layoutSubtree.size > 0 || layoutBubble.size > 0) {
            const dirtyLayoutNodes = new Set([...layoutSubtree, ...layoutBubble])
            if (lastStyles && lastLayout) {
                lastLayout = computeLayoutIncremental(
                    root, lastStyles, lastLayout, dirtyLayoutNodes, size.width, size.height,
                )
            } else {
                lastLayout = lastStyles ? computeLayout(root, lastStyles, size.width, size.height) : undefined
            }
        }

        // Step 3: Repaint
        const noLayoutChanges = layoutSubtree.size === 0 && layoutBubble.size === 0
        const dirtyPaintNodes = new Set(snap.paintOnly)
        // Style-resolved nodes that didn't affect layout still need repaint
        if (noLayoutChanges) {
            for (const node of snap.styleResolve) dirtyPaintNodes.add(node)
        }

        if (noLayoutChanges && dirtyPaintNodes.size > 0 && prevBuffer && lastStyles && lastLayout) {
            const buffer = prevBuffer.clone()
            paintNodes(dirtyPaintNodes, buffer, lastStyles, lastLayout, root)
            const output = diffBuffers(prevBuffer, buffer)
            if (output.length > 0) writeOutput(output)
            prevBuffer = buffer
        } else {
            const buffer = new CellBuffer(size.width, size.height)
            paint(root, buffer, lastStyles, lastLayout)
            const output = diffBuffers(prevBuffer, buffer)
            if (output.length > 0) writeOutput(output)
            prevBuffer = buffer
        }
    }

    const focusManager = new FocusManager()

    // Schedule render on mutations
    const origInsert = ctx.onInsert.bind(ctx)
    ctx.onInsert = (parent: TermNode, child: TermNode) => {
        origInsert(parent, child)
        // Register focusable/mutation callbacks on newly inserted nodes
        if (initialRegistrationDone) {
            registerFocusableNodes(child, focusManager)
            registerMutationCallbacks(child, ctx, scheduleRender)
        }
        scheduleRender()
    }

    // Schedule render for other mutations
    const origSetText = ctx.onSetText.bind(ctx)
    ctx.onSetText = (node: TermNode, text: string) => {
        origSetText(node, text)
        scheduleRender()
    }

    const origSetAttr = ctx.onSetAttribute.bind(ctx)
    ctx.onSetAttribute = (node: TermNode, key: string, value: string) => {
        origSetAttr(node, key, value)
        scheduleRender()
    }

    const origRemoveAttr = ctx.onRemoveAttribute.bind(ctx)
    ctx.onRemoveAttribute = (node: TermNode, key: string) => {
        origRemoveAttr(node, key)
        scheduleRender()
    }

    const origRemove = ctx.onRemove.bind(ctx)
    ctx.onRemove = (child: TermNode, parent: TermNode) => {
        origRemove(child, parent)
        unregisterFocusableNodes(child, focusManager)
        child.cleanup()
        scheduleRender()
    }

    if (fullscreen) enterFullscreen()
    if (mouseEnabled) writeOutput(ansi.enableMouse())
    enableRawMode()

    // Initial render: mount component and do full recompute
    ctx.queue.setFullRecompute()
    const { unmount: svUnmount } = renderer.render(
        AppComponent as any,
        { target: root, props: (options as any)?.props ?? {} },
    )
    scheduleRender()

    const cleanup = createCleanup(svUnmount, fullscreen, mouseEnabled)
    setupInputHandlers(scheduleRender, cleanup, focusManager, () => root, () => lastLayout, ctx)
    setupResizeHandler(() => { ctx.onResize(); prevBuffer = null; scheduleRender() })

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
    ctx: RenderContext,
): void {
    process.stdin.on('data', (data: Buffer) => {
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
            const prev = focusManager.focused
            focusManager.focusPrevious()
            if (prev) ctx.queue.enqueueStyleResolve(prev)
            if (focusManager.focused) ctx.queue.enqueueStyleResolve(focusManager.focused)
            scheduleRender()
            return
        }

        if (key.key === 'Tab') {
            const prev = focusManager.focused
            focusManager.focusNext()
            if (prev) ctx.queue.enqueueStyleResolve(prev)
            if (focusManager.focused) ctx.queue.enqueueStyleResolve(focusManager.focused)
            scheduleRender()
            return
        }

        if (key.key === 'Enter' && focusManager.focused) {
            dispatchEvent(focusManager.focused, 'click')
            return
        }

        if (focusManager.focused) {
            dispatchEvent(focusManager.focused, 'keydown', key)
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

function setupResizeHandler(onResize: () => void): void {
    process.stdout.on('resize', onResize)
}

function registerMutationCallbacks(node: TermNode, ctx: RenderContext, scheduleRender: () => void): void {
    if (node.nodeType === 'text') {
        node.onMutate = () => {
            ctx.queue.enqueuePaintOnly(node)
            scheduleRender()
        }
    }
    for (const child of node.children) {
        registerMutationCallbacks(child, ctx, scheduleRender)
    }
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

function unregisterFocusableNodes(node: TermNode, focusManager: FocusManager): void {
    if (node.nodeType === 'element' && FOCUSABLE_TAGS.has(node.tag ?? '')) {
        focusManager.unregister(node)
    }
    for (const child of node.children) {
        unregisterFocusableNodes(child, focusManager)
    }
}

export { TermNode } from './renderer/node.js'
export { CellBuffer } from './render/buffer.js'
export { parseCSS } from './css/parser.js'
export { resolveStyles } from './css/compute.js'
