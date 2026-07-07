<script>
    // One component, two targets: this file compiles for the terminal
    // (customRenderer) and the browser DOM (regular Svelte) unchanged.
    // The stylesheet dual-targets too: ch units are cells in the
    // terminal and character-width in the browser, and paired
    // declarations let each target keep the one it understands.
    let count = $state(0)
    let level = $state(3)
    const LEVELS = 8

    const gauge = $derived('█'.repeat(level) + '░'.repeat(LEVELS - level))
</script>

<div class="app">
    <span class="title">Dual target</span>
    <span class="sub">one component — terminal and browser</span>

    <div class="row">
        <span class="label">count</span>
        <span class="value">{count}</span>
        <button onclick={() => count++}>+1</button>
    </div>

    <div class="row">
        <span class="label">level</span>
        <span class="gauge">{gauge}</span>
        <button onclick={() => level = (level % LEVELS) + 1}>bump</button>
    </div>

    <span class="hint">Tab + Enter in the terminal · click in the browser</span>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        gap: 1ch;
        padding: 1ch 2ch;
        width: 48ch;
        /* browser takes the px border, terminal takes the single */
        border: 1px solid gray;
        border: single;
        border-color: gray;
        font-family: monospace;
    }

    .title {
        font-weight: bold;
        color: cyan;
    }

    .sub {
        color: gray;
    }

    .row {
        display: flex;
        flex-direction: row;
        gap: 2ch;
    }

    .label {
        color: gray;
        width: 6ch;
    }

    .value {
        color: yellow;
        width: 4ch;
    }

    .gauge {
        color: green;
    }

    button {
        color: cyan;
        background: none;
        border: 1px solid cyan;
        border: single;
        border-color: cyan;
        font-family: monospace;
    }

    .hint {
        color: gray;
    }
</style>
