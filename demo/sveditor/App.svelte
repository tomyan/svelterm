<script>
    import { writeFileSync } from 'fs'
    import { basename } from 'path'

    let { path = '', content = '' } = $props()

    const name = $derived(basename(path))

    let value = $state(content)
    let savedValue = $state(content)
    let cursor = $state(content.length)
    let flash = $state('')

    const modified = $derived(value !== savedValue)
    const position = $derived.by(() => {
        const before = value.substring(0, cursor)
        const row = (before.match(/\n/g) ?? []).length
        const col = before.length - (before.lastIndexOf('\n') + 1)
        return `${row + 1}:${col + 1}`
    })

    function onInput(e) {
        value = e.data?.value ?? value
        cursor = e.data?.cursor ?? cursor
        flash = ''
    }

    function onSelectionChange(e) {
        cursor = e.data?.cursor ?? cursor
    }

    function onKeydown(e) {
        if (e.data?.ctrl && e.data.key === 's') save()
    }

    function save() {
        try {
            writeFileSync(path, value)
            savedValue = value
            flash = 'saved'
        } catch (err) {
            flash = `save failed: ${err?.message ?? err}`
        }
    }
</script>

<div class="app" onkeydown={onKeydown}>
    <div class="header">
        <span class="name">{name}{modified ? ' ●' : ''}</span>
        <span class="flash">{flash}</span>
    </div>

    <textarea class="editor" oninput={onInput} onselectionchange={onSelectionChange}>{content}</textarea>

    <div class="status">
        <span class="pos">{position}</span>
        <span class="hint">Tab focuses · Ctrl+S saves · Ctrl+_ undo · Ctrl+C exits</span>
    </div>
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
        height: 100%;
        padding: 0 1cell;
    }

    .header {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .name {
        font-weight: bold;
        color: var(--primary);
    }

    .flash {
        color: var(--accent);
    }

    .editor {
        flex-grow: 1;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
    }

    .editor:focus {
        border-color: var(--primary);
    }

    .status {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
    }

    .pos {
        color: var(--accent);
    }

    .hint {
        color: var(--muted);
    }
</style>
