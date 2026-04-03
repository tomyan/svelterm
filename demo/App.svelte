<script>
    let count = $state(0)
</script>

<style>
    :root {
        --primary: cyan;
        --accent: yellow;
        --muted: gray;
        --bg-panel: blue;
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
        border-color: var(--primary);
        color: var(--primary);
    }

    .hint {
        opacity: dim;
        color: var(--muted);
    }
</style>

<div class="app">
    <span class="title">Svelterm — CSS Variables + Theming</span>
    <div class="panels">
        <div class="panel">
            <span>Counter</span>
            <span class="count">{count}</span>
            <button onclick={() => count++}>Increment</button>
        </div>
        <div class="panel">
            <span>Features</span>
            <ul>
                <li>CSS Variables</li>
                <li>Flexbox Layout</li>
                <li>Borders</li>
            </ul>
        </div>
    </div>
    <span class="hint">Tab to focus, Enter to click, Ctrl+C to exit</span>
</div>
