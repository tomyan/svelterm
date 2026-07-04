/**
 * Debug-protocol client for the DevTools TUI: a request/response wrapper
 * over the WebSocket the debug server exposes. Pure logic (tree
 * flattening) is separated so it can be unit-tested without a socket.
 */

export interface DebugClient {
    request(method: string, params?: Record<string, unknown>): Promise<any>
    close(): void
}

export interface SerialNode {
    nodeId: number
    nodeType: string
    tag?: string
    text?: string
    attributes?: Record<string, string>
    children: SerialNode[]
}

export interface FlatNode {
    node: SerialNode
    depth: number
    /** A one-line label: `<div.card#main>` / `"text"` / `<!--comment-->`. */
    label: string
}

/** Connect to a debug server on 127.0.0.1:port. */
export async function connectDebugClient(port: number): Promise<DebugClient> {
    const { WebSocket } = await import('ws')
    const ws = new WebSocket(`ws://127.0.0.1:${port}`)
    await new Promise<void>((resolve, reject) => {
        ws.on('open', () => resolve())
        ws.on('error', (err: Error) => reject(err))
    })
    let nextId = 1
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
    ws.on('message', (data: any) => {
        try {
            const msg = JSON.parse(data.toString())
            const entry = pending.get(msg.id)
            if (!entry) return
            pending.delete(msg.id)
            if (msg.error) entry.reject(new Error(msg.error.message))
            else entry.resolve(msg.result)
        } catch { /* ignore malformed */ }
    })
    return {
        request(method, params = {}) {
            const id = nextId++
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject })
                ws.send(JSON.stringify({ id, method, params }))
            })
        },
        close() { ws.close() },
    }
}

/** Flatten the tree depth-first into indented, labelled rows. */
export function flattenTree(root: SerialNode): FlatNode[] {
    const out: FlatNode[] = []
    const walk = (node: SerialNode, depth: number) => {
        out.push({ node, depth, label: labelFor(node) })
        for (const child of node.children) walk(child, depth + 1)
    }
    walk(root, 0)
    return out
}

/** A compact one-line label for a node. */
export function labelFor(node: SerialNode): string {
    if (node.nodeType === 'text') {
        const text = (node.text ?? '').trim().replace(/\s+/g, ' ')
        return text ? `"${truncate(text, 40)}"` : '(whitespace)'
    }
    if (node.nodeType === 'comment') return '<!--comment-->'
    const cls = node.attributes?.class ? '.' + node.attributes.class.split(/\s+/).join('.') : ''
    const id = node.attributes?.id ? '#' + node.attributes.id : ''
    return `<${node.tag ?? '?'}${id}${cls}>`
}

function truncate(text: string, max: number): string {
    return text.length <= max ? text : text.slice(0, max - 1) + '…'
}
