<script>
    let count = $state(0)
    let focusedName = $state('none')
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
        width: 30cell;
        border: rounded;
        border-color: var(--primary);
        padding: 0 1cell;
        display: flex;
        flex-direction: column;
    }

    .panel-title {
        font-weight: bold;
    }

    .count {
        color: var(--accent);
        font-weight: bold;
    }

    .buttons {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    button {
        color: var(--muted);
    }

    button:focus {
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
            <span class="panel-title">Counter: <span class="count">{count}</span></span>
            <div class="buttons">
                <button
                    onclick={() => count++}
                    onfocus={() => focusedName = 'Increment'}
                    onblur={() => focusedName = 'none'}
                >[+]</button>
                <button
                    onclick={() => count--}
                    onfocus={() => focusedName = 'Decrement'}
                    onblur={() => focusedName = 'none'}
                >[-]</button>
                <button
                    onclick={() => count = 0}
                    onfocus={() => focusedName = 'Reset'}
                    onblur={() => focusedName = 'none'}
                >[0]</button>
            </div>
        </div>
        <div class="panel">
            <span class="panel-title">Features</span>
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
