<script>
    let count = $state(0)
    let focusedName = $state('none')

    $effect(() => {
        console.log(`Counter changed: ${count}`)
    })
</script>

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

    .title {
        color: var(--primary);
        font-weight: bold;
    }

    .panels {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    .panel {
        width: 25cell;
        border: rounded;
        border-color: var(--primary);
        padding: 1cell;
        display: flex;
        flex-direction: column;
        gap: 1cell;
    }

    .count {
        color: var(--accent);
        font-weight: bold;
    }

    button {
        border: single;
        border-color: var(--muted);
        padding: 0 2cell;
    }

    button:focus {
        border-color: var(--accent);
        color: var(--accent);
        font-weight: bold;
    }

    .focus-indicator {
        color: var(--accent);
    }

    .focus-label {
        color: var(--muted);
    }

    .hint {
        opacity: dim;
        color: var(--muted);
    }
</style>

<div class="app">
    <span class="title">Svelterm — Counter Demo</span>
    <div class="panels">
        <div class="panel">
            <span>Counter</span>
            <span class="count">{count}</span>
            <button
                onclick={() => count++}
                onfocus={() => focusedName = 'Increment'}
                onblur={() => focusedName = 'none'}
            >Increment</button>
            <button
                onclick={() => count--}
                onfocus={() => focusedName = 'Decrement'}
                onblur={() => focusedName = 'none'}
            >Decrement</button>
            <button
                onclick={() => count = 0}
                onfocus={() => focusedName = 'Reset'}
                onblur={() => focusedName = 'none'}
            >Reset</button>
        </div>
        <div class="panel">
            <span>Features</span>
            <ul>
                <li>CSS Variables</li>
                <li>Flexbox Layout</li>
                <li>Focus + :focus</li>
                <li>Event Handling</li>
            </ul>
        </div>
    </div>
    <span><span class="focus-label">Focused: </span><span class="focus-indicator">{focusedName}</span></span>
    <span class="hint">Tab to focus, Enter to click, Ctrl+C to exit</span>
</div>
