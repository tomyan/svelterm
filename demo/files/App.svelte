<script>
    import { readdirSync } from 'fs'
    import { join, dirname, relative, basename } from 'path'

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

    <div class="listing">
        {#if entries.length === 0}
            <span class="empty">(empty directory)</span>
        {/if}
        {#each entries as entry, i (entry.name)}
            <span class={i === selected ? 'row-selected' : 'row'}>
                {entry.isDir ? entry.name + '/' : entry.name}
            </span>
        {/each}
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

    .listing {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
        flex-grow: 1;
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
