<script>
    // Each game cell renders as 2 terminal columns to compensate
    // for the ~1:2 terminal cell aspect ratio
    const W = 30
    const H = 20

    let snake = $state([{ x: 15, y: 10 }, { x: 14, y: 10 }, { x: 13, y: 10 }])
    let food = $state({ x: 20, y: 5 })
    let dir = $state({ x: 1, y: 0 })
    let score = $state(0)
    let gameOver = $state(false)
    let speed = $state(120)

    function spawnFood() {
        let fx, fy
        do {
            fx = Math.floor(Math.random() * W)
            fy = Math.floor(Math.random() * H)
        } while (snake.some(s => s.x === fx && s.y === fy))
        food = { x: fx, y: fy }
    }

    function tick() {
        if (gameOver) return

        const head = snake[0]
        const nx = head.x + dir.x
        const ny = head.y + dir.y

        // Wall collision
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
            gameOver = true
            return
        }

        // Self collision
        if (snake.some(s => s.x === nx && s.y === ny)) {
            gameOver = true
            return
        }

        const newHead = { x: nx, y: ny }
        const ate = nx === food.x && ny === food.y

        if (ate) {
            snake = [newHead, ...snake]
            score += 10
            if (speed > 60) speed -= 3
            spawnFood()
        } else {
            snake = [newHead, ...snake.slice(0, -1)]
        }
    }

    function handleKey(key) {
        if (gameOver && key === 'r') {
            snake = [{ x: 15, y: 10 }, { x: 14, y: 10 }, { x: 13, y: 10 }]
            dir = { x: 1, y: 0 }
            score = 0
            gameOver = false
            speed = 120
            spawnFood()
            return
        }
        if (key === 'ArrowUp' && dir.y === 0) dir = { x: 0, y: -1 }
        else if (key === 'ArrowDown' && dir.y === 0) dir = { x: 0, y: 1 }
        else if (key === 'ArrowLeft' && dir.x === 0) dir = { x: -1, y: 0 }
        else if (key === 'ArrowRight' && dir.x === 0) dir = { x: 1, y: 0 }
    }

    let intervalId
    $effect(() => {
        intervalId = setInterval(tick, speed)
        return () => clearInterval(intervalId)
    })

    // Build display grid
    let grid = $derived.by(() => {
        const rows = []
        for (let y = 0; y < H; y++) {
            let row = ''
            for (let x = 0; x < W; x++) {
                const isHead = snake[0].x === x && snake[0].y === y
                const isBody = !isHead && snake.some(s => s.x === x && s.y === y)
                const isFood = food.x === x && food.y === y
                if (isHead) row += '●●'
                else if (isBody) row += '██'
                else if (isFood) row += '◆◆'
                else row += '  '
            }
            rows.push(row)
        }
        return rows
    })
</script>

<div class="game" onkeydown={(e) => handleKey(e.data?.key)}>
    <div class="header">
        <span class="title">SNAKE</span>
        <span class="score">Score: {score}</span>
    </div>

    <div class="board">
        {#each grid as row}
            <span class="board-row">{row}</span>
        {/each}
    </div>

    {#if gameOver}
        <div class="game-over-overlay">
            <span class="game-over-text">GAME OVER</span>
            <span class="final-score">Final Score: {score}</span>
            <span class="hint">Press R to restart</span>
        </div>
    {/if}

    <span class="footer">Arrow keys to move, Ctrl+C to exit</span>
</div>

<style>
    :root {
        --primary: cyan;
        --snake: green;
        --food: red;
        --muted: gray;
    }

    .game {
        display: flex;
        flex-direction: column;
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

    .score {
        font-weight: bold;
        color: yellow;
    }

    .board {
        border: rounded;
        border-color: var(--muted);
        width: 62cell;
        height: 22cell;
    }

    .board-row {
        display: block;
        color: var(--snake);
    }

    .game-over-overlay {
        display: flex;
        flex-direction: column;
        border: double;
        border-color: red;
        padding: 1cell 2cell;
        text-align: center;
    }

    .game-over-text {
        font-weight: bold;
        color: red;
    }

    .final-score {
        font-weight: bold;
        color: yellow;
    }

    .hint {
        color: var(--muted);
        opacity: dim;
    }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>
