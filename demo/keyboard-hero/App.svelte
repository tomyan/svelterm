<script>
    const COLS = 7
    const KEYS = 'asdfghj'
    const BOARD_HEIGHT = 12
    const INITIAL_SPEED = 800
    const SPEED_DECREASE = 20
    const MIN_SPEED = 200

    let score = $state(0)
    let lives = $state(5)
    let gameOver = $state(false)
    let level = $state(1)
    let speed = $state(INITIAL_SPEED)

    // Each falling note: { key, col, row, hit, miss }
    let notes = $state([])
    let flash = $state('')
    let combo = $state(0)

    function spawnNote() {
        if (gameOver) return
        const col = Math.floor(Math.random() * COLS)
        const key = KEYS[col]
        notes = [...notes, { key, col, row: 0, hit: false, miss: false }]
    }

    function tick() {
        if (gameOver) return

        // Move notes down
        notes = notes.map(n => {
            if (n.hit || n.miss) return n
            const newRow = n.row + 1
            if (newRow >= BOARD_HEIGHT) {
                // Missed!
                lives = Math.max(0, lives - 1)
                combo = 0
                if (lives <= 0) {
                    gameOver = true
                }
                return { ...n, row: BOARD_HEIGHT - 1, miss: true }
            }
            return { ...n, row: newRow }
        })

        // Remove old hit/miss notes
        notes = notes.filter(n => {
            if (n.hit) return false
            if (n.miss && n.row >= BOARD_HEIGHT - 1) return false
            return true
        })

        // Maybe spawn new note
        if (Math.random() < 0.4) spawnNote()

        // Level up every 100 points
        const newLevel = Math.floor(score / 100) + 1
        if (newLevel > level) {
            level = newLevel
            speed = Math.max(MIN_SPEED, INITIAL_SPEED - (level - 1) * SPEED_DECREASE)
        }
    }

    function handleKey(key) {
        if (gameOver) {
            if (key === 'r') restart()
            return
        }

        const col = KEYS.indexOf(key)
        if (col === -1) return

        // Find lowest unhit note in this column near the target row
        const targetRow = BOARD_HEIGHT - 2
        const candidates = notes
            .filter(n => n.col === col && !n.hit && !n.miss && n.row >= targetRow - 2)
            .sort((a, b) => b.row - a.row)

        if (candidates.length > 0) {
            const note = candidates[0]
            note.hit = true
            combo++
            const comboBonus = combo >= 5 ? 2 : 1
            score += 10 * comboBonus
            flash = key
            setTimeout(() => { flash = '' }, 150)
        } else {
            combo = 0
        }
    }

    function restart() {
        score = 0
        lives = 5
        gameOver = false
        level = 1
        speed = INITIAL_SPEED
        notes = []
        combo = 0
    }

    // Game loop
    let intervalId
    $effect(() => {
        intervalId = setInterval(tick, speed)
        return () => clearInterval(intervalId)
    })

    // Build display grid
    let grid = $derived.by(() => {
        const rows = []
        for (let r = 0; r < BOARD_HEIGHT; r++) {
            let row = ''
            for (let c = 0; c < COLS; c++) {
                const note = notes.find(n => n.col === c && n.row === r && !n.hit)
                if (note) {
                    row += note.miss ? '✗' : note.key.toUpperCase()
                } else {
                    row += '·'
                }
                if (c < COLS - 1) row += '  '
            }
            rows.push(row)
        }
        return rows
    })

    let livesDisplay = $derived('♥'.repeat(lives) + '♡'.repeat(5 - lives))

    let keyDisplay = $derived(
        KEYS.split('').map(k => `[${k.toUpperCase()}]`).join(' ')
    )
</script>

<style>
    :root {
        --primary: cyan;
        --accent: yellow;
        --hit: green;
        --miss: red;
        --muted: gray;
    }

    .game {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .header {
        display: flex;
        flex-direction: row;
        border: double;
        border-color: var(--primary);
        padding: 0 2cell;
    }

    .title {
        font-weight: bold;
        color: var(--primary);
        flex-grow: 1;
    }

    .score-display {
        font-weight: bold;
        color: var(--accent);
    }

    .lives {
        color: var(--miss);
    }

    .stats {
        display: flex;
        flex-direction: row;
        gap: 3cell;
    }

    .stat-label {
        color: var(--muted);
    }

    .stat-value {
        font-weight: bold;
        color: var(--accent);
    }

    .combo-display {
        font-weight: bold;
        color: var(--hit);
    }

    .board {
        border: rounded;
        border-color: var(--muted);
        padding: 0 2cell;
        display: flex;
        flex-direction: column;
    }

    .board-row {
        color: var(--muted);
    }

    .target-line {
        color: var(--primary);
        font-weight: bold;
    }

    .key-row {
        text-align: center;
        font-weight: bold;
        color: var(--primary);
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
    }

    .key-row-flash {
        text-align: center;
        font-weight: bold;
        color: var(--hit);
        border: single;
        border-color: var(--hit);
        padding: 0 1cell;
    }

    .game-over {
        border: double;
        border-color: var(--miss);
        padding: 1cell 2cell;
        text-align: center;
    }

    .game-over-title {
        font-weight: bold;
        color: var(--miss);
    }

    .game-over-score {
        font-weight: bold;
        color: var(--accent);
    }

    .game-over-hint {
        color: var(--muted);
        opacity: dim;
    }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>

<div class="game" onkeydown={(e) => handleKey(e.data?.key)}>
    <div class="header">
        <span class="title">KEYBOARD HERO</span>
        <span class="score-display">Score: {score}</span>
        <span class="lives">{livesDisplay}</span>
    </div>

    <div class="stats">
        <span><span class="stat-label">Level: </span><span class="stat-value">{level}</span></span>
        <span><span class="stat-label">Speed: </span><span class="stat-value">{speed}ms</span></span>
        {#if combo >= 3}
            <span class="combo-display">🔥 x{combo}</span>
        {/if}
    </div>

    <div class="board">
        {#each grid as row, i}
            {#if i === BOARD_HEIGHT - 2}
                <span class="target-line">{row}</span>
            {:else}
                <span class="board-row">{row}</span>
            {/if}
        {/each}
    </div>

    <div class={flash ? 'key-row-flash' : 'key-row'}>
        <span>{keyDisplay}</span>
    </div>

    {#if gameOver}
        <div class="game-over">
            <span class="game-over-title">GAME OVER</span>
            <span class="game-over-score">Final Score: {score}</span>
            <span class="game-over-hint">Press R to restart</span>
        </div>
    {/if}

    <span class="footer">Type the falling letters! Ctrl+C to exit</span>
</div>
