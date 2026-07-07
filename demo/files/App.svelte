<script>
    import { readdirSync, readFileSync } from 'fs'
    import { join, dirname, relative, basename } from 'path'

    const WINDOW = 12
    const PREVIEW_LINES = 12

    const root = process.env.SVELTERM_BROWSE_ROOT ?? process.cwd()
    let dir = $state(root)
    let selected = $state(0)

    const shownPath = $derived(basename(root) + '/' + relative(root, dir))

    const entries = $derived.by(() => {
        try {
            const found = readdirSync(dir, { withFileTypes: true })
            const dirs = found.filter(e => e.isDirectory()).map(e => e.name).sort()
            const files = found.filter(e => !e.isDirectory()).map(e => e.name).sort()
            return [
                ...dirs.map(name => ({ name, isDir: true })),
                ...files.map(name => ({ name, isDir: false })),
            ]
        } catch {
            return []
        }
    })

    // The listing shows a window of rows that follows the selection
    const windowStart = $derived(Math.max(0,
        Math.min(selected - Math.floor(WINDOW / 2), entries.length - WINDOW)))
    const visible = $derived(entries.slice(windowStart, windowStart + WINDOW))
    const hiddenAbove = $derived(windowStart)
    const hiddenBelow = $derived(Math.max(0, entries.length - windowStart - WINDOW))

    const preview = $derived.by(() => {
        const entry = entries[selected]
        if (!entry) return []
        const full = join(dir, entry.name)
        try {
            if (entry.isDir) {
                const count = readdirSync(full).length
                return [`${count} item${count === 1 ? '' : 's'}`]
            }
            return readFileSync(full, 'utf-8').split('\n').slice(0, PREVIEW_LINES)
        } catch {
            return ['(unreadable)']
        }
    })

    function handleKey(key) {
        if (key === 'ArrowUp') selected = Math.max(0, selected - 1)
        else if (key === 'ArrowDown') selected = Math.min(entries.length - 1, selected + 1)
        else if (key === 'Enter') open(entries[selected])
        else if (key === 'Backspace') up()
    }

    function open(entry) {
        if (!entry?.isDir) return
        dir = join(dir, entry.name)
        selected = 0
    }

    function up() {
        if (dir === root) return
        dir = dirname(dir)
        selected = 0
    }
</script>

<div class="app" onkeydown={(e) => handleKey(e.data?.key)}>
    <span class="path">{shownPath}</span>

    <div class="panes">
        <div class="listing">
            {#if entries.length === 0}
                <span class="empty">(empty directory)</span>
            {/if}
            {#if hiddenAbove > 0}
                <span class="more">↑ {hiddenAbove} more</span>
            {/if}
            {#each visible as entry, i (entry.name)}
                <span class={i + windowStart === selected ? 'row-selected' : 'row'}>
                    {entry.isDir ? entry.name + '/' : entry.name}
                </span>
            {/each}
            {#if hiddenBelow > 0}
                <span class="more">↓ {hiddenBelow} more</span>
            {/if}
        </div>
        <div class="preview">
            {#each preview as line, i (i)}
                <span class="preview-line">{line}</span>
            {/each}
        </div>
    </div>

    <span class="status">{entries.length === 0 ? '0/0' : `${selected + 1}/${entries.length}`}  {entries[selected]?.name ?? ''}</span>
    <span class="hint">↑/↓ select, Enter opens a directory, Backspace goes up, Ctrl+C exits</span>
</div>

<style>
    :root {
        --primary: cyan;
        --accent: yellow;
        --muted: gray;
    }

    .app {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .path {
        font-weight: bold;
        color: var(--primary);
        border: single;
        border-color: var(--primary);
        padding: 0 1cell;
    }

    .panes {
        display: flex;
        flex-direction: row;
        gap: 1cell;
        flex-grow: 1;
    }

    .listing {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
        flex-grow: 1;
    }

    .preview {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
        flex-grow: 1;
    }

    .preview-line {
        white-space: pre;
    }

    .more {
        color: var(--muted);
        font-style: italic;
    }

    .row {
        white-space: pre;
    }

    .row-selected {
        white-space: pre;
        color: var(--accent);
        font-weight: bold;
        background: var(--muted);
    }

    .empty {
        color: var(--muted);
        font-style: italic;
    }

    .status {
        color: var(--accent);
    }

    .hint {
        color: var(--muted);
    }
</style>
