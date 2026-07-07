<script>
    const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

    // 6x6x6 cube slice rows: for each green level, a red x blue strip
    const cubeRows = []
    for (let g = 0; g < 6; g++) {
        const row = []
        for (let r = 0; r < 6; r++) {
            for (let b = 0; b < 6; b++) {
                row.push(`rgb(${r * 51}, ${g * 51}, ${b * 51})`)
            }
        }
        cubeRows.push(row)
    }

    // Truecolor gradient sweep across the hue wheel
    const SWEEP_CELLS = 72
    const sweep = []
    for (let i = 0; i < SWEEP_CELLS; i++) {
        const hue = (i / SWEEP_CELLS) * 360
        sweep.push(`hsl(${Math.round(hue)}, 90%, 55%)`)
    }

    const grays = []
    for (let i = 0; i < 24; i++) {
        const v = 8 + i * 10
        grays.push(`rgb(${v}, ${v}, ${v})`)
    }
</script>

<div class="app">
    <span class="title">Colour palettes</span>

    <div class="section">
        <span class="label">16 ANSI colours (named, depth-independent)</span>
        <div class="row">
            {#each ANSI as name (name)}
                <span class="swatch" style={`background: ${name}`}>{'  '}</span>
            {/each}
            {#each ANSI as name (name)}
                <span class="swatch" style={`background: bright${name}`}>{'  '}</span>
            {/each}
        </div>
    </div>

    <div class="section">
        <span class="label">256-colour cube (6×6×6)</span>
        {#each cubeRows as row, g (g)}
            <div class="row">
                {#each row as color, i (i)}
                    <span class="cell" style={`background: ${color}`}>{' '}</span>
                {/each}
            </div>
        {/each}
    </div>

    <div class="section">
        <span class="label">24-bit hue sweep</span>
        <div class="row">
            {#each sweep as color, i (i)}
                <span class="cell" style={`background: ${color}`}>{' '}</span>
            {/each}
        </div>
    </div>

    <div class="section">
        <span class="label">Grayscale ramp</span>
        <div class="row">
            {#each grays as color, i (i)}
                <span class="swatch" style={`background: ${color}`}>{'  '}</span>
            {/each}
        </div>
    </div>

    <span class="hint">Rendering adapts to the terminal's colour depth — Ctrl+C exits</span>
</div>

<style>
    :root {
        --muted: gray;
    }

    .app {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .title {
        font-weight: bold;
        color: cyan;
    }

    .section {
        display: flex;
        flex-direction: column;
    }

    .label {
        color: var(--muted);
    }

    .row {
        display: flex;
        flex-direction: row;
        white-space: pre;
    }

    .swatch {
        white-space: pre;
    }

    .cell {
        white-space: pre;
    }

    .hint {
        color: var(--muted);
    }
</style>
