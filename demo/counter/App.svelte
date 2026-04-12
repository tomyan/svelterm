<script>
    let count = $state(0)
    let focusedName = $state('none')

    $effect(() => {
        console.log(`Counter changed: ${count}`)
    })
</script>

<style>
    :root {
        --primary: #00b4d8;
        --accent: #e6a817;
        --muted: #888;
    }

    .app {
        display: flex;
        flex-direction: column;
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
    }

    .count {
        color: var(--accent);
        font-weight: bold;
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
            border: 2px solid var(--primary);
            border-radius: 8px;
            padding: 1rem;
            gap: 0.75rem;
        }

        button {
            border: 1px solid var(--muted);
            border-radius: 4px;
            padding: 0.4rem 1.2rem;
            background: white;
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
            border-color: var(--primary);
            padding: 1cell;
            gap: 1cell;
        }

        button {
            border: single;
            border-color: var(--muted);
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
