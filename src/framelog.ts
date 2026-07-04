/**
 * FrameLog — an append-only log of frames for inline mode. Each frame is
 * a mounted component; archiving hands its rows to the terminal's
 * scrollback and frees the component, so a long session's memory tracks
 * what's live, not the whole history.
 *
 * The host element should be the first content on screen (frames release
 * from the top). To update a frame after append, pass a `$state` object
 * as its props and mutate it — or use `update()`, which assigns onto that
 * same object.
 */

import { mount, unmount } from 'svelte/renderer'
import defaultRenderer from './renderer/default.js'
import { TermNode } from './renderer/node.js'

interface InlineHooks {
    /** Hand the top n screen rows of the live area to scrollback. */
    releaseTop(n: number): void
}

const inlineHooksByRoot = new WeakMap<TermNode, InlineHooks>()

/** Called by run() in inline mode so FrameLogs can archive rows. */
export function registerInlineHooks(root: TermNode, hooks: InlineHooks): void {
    inlineHooksByRoot.set(root, hooks)
}

interface FrameLogDeps {
    mount: (component: any, options: any) => object
    unmount: (app: object) => void
    renderer: unknown
}

interface Frame {
    id: number
    container: TermNode
    app: object
    props: Record<string, unknown>
}

export class FrameLog {
    private frames: Frame[] = []
    private nextId = 1

    constructor(private host: TermNode, private deps: FrameLogDeps = {
        mount, unmount, renderer: defaultRenderer,
    }) {}

    /** Mount a component as a new frame at the bottom of the log. */
    append<P extends Record<string, unknown>>(component: unknown, props: P): number {
        const container = new TermNode('element', 'div')
        container.attributes.set('data-frame', String(this.nextId))
        this.host.insertBefore(container, null)
        const app = this.deps.mount(component, {
            renderer: this.deps.renderer,
            target: container,
            props,
        })
        const id = this.nextId++
        this.frames.push({ id, container, app, props })
        return id
    }

    /**
     * Assign new values onto the frame's props object. Reaches the
     * component only when the props were created with `$state`.
     */
    update(id: number, partial: Record<string, unknown>): void {
        const frame = this.frames.find(f => f.id === id)
        if (!frame) throw new Error(`FrameLog: no live frame ${id}`)
        Object.assign(frame.props, partial)
    }

    /**
     * Archive every frame up to and including `id`: their rows stay on
     * the terminal and scroll into history; their components unmount.
     */
    archive(id: number): void {
        const index = this.frames.findIndex(f => f.id === id)
        if (index < 0) throw new Error(`FrameLog: no live frame ${id}`)
        const archived = this.frames.slice(0, index + 1)
        const rows = archived.reduce(
            (sum, frame) => sum + (frame.container.cache.layoutBox?.height ?? 0), 0)
        this.rootHooks()?.releaseTop(rows)
        for (const frame of archived) this.dispose(frame)
        this.frames.splice(0, index + 1)
    }

    /** Remove a frame outright — its rows clear and the log reflows. */
    remove(id: number): void {
        const index = this.frames.findIndex(f => f.id === id)
        if (index < 0) throw new Error(`FrameLog: no live frame ${id}`)
        this.dispose(this.frames[index])
        this.frames.splice(index, 1)
    }

    /** IDs of the frames still live, in order. */
    liveFrames(): number[] {
        return this.frames.map(f => f.id)
    }

    private dispose(frame: Frame): void {
        this.deps.unmount(frame.app)
        this.host.removeChild(frame.container)
    }

    private rootHooks(): InlineHooks | undefined {
        let node: TermNode = this.host
        while (node.parent) node = node.parent
        return inlineHooksByRoot.get(node)
    }
}

/**
 * A FrameLog bound to a host element — from a component, grab the node
 * with `bind:this` and create the log once on mount.
 */
export function createFrameLog(host: TermNode): FrameLog {
    return new FrameLog(host)
}
