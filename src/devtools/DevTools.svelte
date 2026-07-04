<script>
    import { connectDebugClient, flattenTree } from './client.js'

    let { port = 9444 } = $props()

    let status = $state('connecting…')
    let rows = $state([])
    let selected = $state(0)
    let detail = $state(null)
    let client = null

    async function refresh() {
        if (!client) return
        try {
            const doc = await client.request('DOM.getDocument')
            rows = flattenTree(doc.root)
            if (selected >= rows.length) selected = Math.max(0, rows.length - 1)
            status = `${rows.length} nodes`
            await loadDetail()
        } catch (err) {
            status = 'error: ' + (err?.message ?? err)
        }
    }

    async function loadDetail() {
        const row = rows[selected]
        if (!client || !row) { detail = null; return }
        if (row.node.nodeType !== 'element') { detail = { note: 'no style for non-element' }; return }
        try {
            const [style, box] = await Promise.all([
                client.request('CSS.getComputedStyle', { nodeId: row.node.nodeId }).catch(() => null),
                client.request('DOM.getBoxModel', { nodeId: row.node.nodeId }).catch(() => null),
            ])
            detail = { style: style?.style, box }
        } catch {
            detail = null
        }
    }

    function styleLines(style) {
        if (!style) return []
        const keys = ['fg', 'bg', 'bold', 'italic', 'underline', 'width', 'height',
            'display', 'borderStyle', 'padding', 'flexDirection']
        return keys
            .filter((k) => style[k] !== undefined && style[k] !== null && style[k] !== '' && style[k] !== false)
            .map((k) => `${k}: ${style[k]}`)
    }

    function onkeydown(event) {
        const key = event.data?.key ?? event.key
        if (key === 'ArrowDown') { selected = Math.min(rows.length - 1, selected + 1); loadDetail() }
        else if (key === 'ArrowUp') { selected = Math.max(0, selected - 1); loadDetail() }
        else if (key === 'r') refresh()
    }

    async function connect(el) {
        try {
            client = await connectDebugClient(port)
            status = 'connected'
            await refresh()
        } catch (err) {
            status = `cannot connect on ${port} — run the app with { debug: true }`
        }
        el.focus?.()
        return () => client?.close()
    }
</script>

<div class="devtools" {onkeydown}>
    <div class="header">svelterm devtools · {status} · ↑↓ select · r refresh · Ctrl+C quit</div>
    <div class="panes">
        <div class="tree" {@attach connect} tabindex="0">
            {#each rows as row, index}
                <div class="node" class:sel={index === selected} style="padding-left: {row.depth * 2}cell;">
                    {row.label}
                </div>
            {/each}
            {#if rows.length === 0}<div class="empty">no nodes</div>{/if}
        </div>
        <div class="detail">
            {#if detail?.style}
                <div class="detail-title">computed style</div>
                {#each styleLines(detail.style) as line}<div class="prop">{line}</div>{/each}
            {/if}
            {#if detail?.box}
                <div class="detail-title">box</div>
                <div class="prop">x {detail.box.x}  y {detail.box.y}</div>
                <div class="prop">w {detail.box.width}  h {detail.box.height}</div>
            {/if}
            {#if detail?.note}<div class="prop dim">{detail.note}</div>{/if}
            {#if !detail}<div class="prop dim">select a node</div>{/if}
        </div>
    </div>
</div>

<style>
    .devtools {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .header {
        background: light-dark(#e0e0d8, #26415c);
        color: light-dark(#0a3055, #cfe6ff);
        padding: 0 1cell;
    }

    .panes {
        display: flex;
        flex-grow: 1;
    }

    .tree {
        width: 50%;
        overflow: auto;
        border-right: single;
        border-color: light-dark(#bbbbbb, #444444);
    }

    .node {
        color: light-dark(#333333, #cccccc);
    }

    .node.sel {
        background: light-dark(#d5e5f5, #26415c);
        color: cyan;
        font-weight: bold;
    }

    .detail {
        width: 50%;
        padding: 0 1cell;
    }

    .detail-title {
        color: yellow;
        font-weight: bold;
    }

    .prop {
        color: light-dark(#333333, #cccccc);
    }

    .prop.dim,
    .empty {
        color: light-dark(#888888, #666666);
        padding: 0 1cell;
    }
</style>
