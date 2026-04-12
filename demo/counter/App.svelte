<script>
    let count = $state(0)
    let focusedName = $state('none')

    $effect(() => {
        console.log(`Counter changed: ${count}`)
    })
</script>

<style>
    /* Light mode (default) */
    :root {
        --primary: #0077b6;
        --accent: #c77d00;
        --muted: #666;
        --fg: #1a1a1a;
        --bg: #ffffff;
        --panel-border: #0077b6;
        --btn-bg: #f5f5f5;
        --btn-border: #ccc;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
        :root {
            --primary: #48cae4;
            --accent: #fbbf24;
            --muted: #999;
            --fg: #e8e8e8;
            --bg: #1a1a2e;
            --panel-border: #48cae4;
            --btn-bg: #2a2a3e;
            --btn-border: #555;
        }
    }

    .app {
        display: flex;
        flex-direction: column;
        color: var(--fg);
    }

    .title {
        color: var(--primary);
        font-weight: bold;
    }

    .panels {
        display: flex;
        flex-direction: row;
    }

    .panel {
        display: flex;
        flex-direction: column;
        border-color: var(--panel-border);
    }

    .count {
        color: var(--accent);
        font-weight: bold;
    }

    button {
        color: var(--fg);
        border-color: var(--btn-border);
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
        color: var(--muted);
    }

    @media (display-mode: browser) {
        .app {
            gap: 1rem;
            padding: 2rem;
            font-family: system-ui, sans-serif;
            max-width: 600px;
        }

        .title { font-size: 1.5rem; }
        .panels { gap: 2rem; }
        .count { font-size: 2rem; }

        .panel {
            border: 2px solid var(--panel-border);
            border-radius: 8px;
            padding: 1rem;
            gap: 0.75rem;
        }

        button {
            border: 1px solid var(--btn-border);
            border-radius: 4px;
            padding: 0.4rem 1.2rem;
            background: var(--btn-bg);
            cursor: pointer;
            font-size: inherit;
        }

        button:hover {
            border-color: var(--primary);
            color: var(--primary);
        }

        button:focus {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
        }

        .hint { opacity: 0.6; }
    }

    @media (display-mode: terminal) {
        .app { gap: 1cell; padding: 1cell 2cell; }
        .panels { gap: 2cell; }

        .panel {
            width: 25cell;
            border: rounded;
            padding: 1cell;
            gap: 1cell;
        }

        button {
            border: single;
            padding: 0 2cell;
        }

        .hint { opacity: dim; }
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
