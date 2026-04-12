<script>
    let cpu = $state(42)
    let memory = $state(1.8)
    let requests = $state(847)
    let errors = $state(2)
    let uptime = $state(0)

    // Simulate real-time updates
    const interval = setInterval(() => {
        cpu = Math.min(100, Math.max(0, cpu + Math.floor(Math.random() * 21) - 10))
        memory = Math.round((memory + (Math.random() - 0.45) * 0.3) * 10) / 10
        memory = Math.max(0.5, Math.min(8, memory))
        requests += Math.floor(Math.random() * 50)
        if (Math.random() < 0.1) errors++
        uptime++
    }, 1000)
</script>

<div class="dashboard">
    <div class="header">Svelterm Dashboard</div>

    <div class="panels">
        <div class="panel">
            <span class="panel-title">CPU</span>
            <span class={cpu > 80 ? 'value-bad' : cpu > 50 ? 'value' : 'value-good'}>{cpu}%</span>
            <span class="bar-track">{'░'.repeat(20)}</span>
            <span class="bar-fill">{'█'.repeat(Math.floor(cpu / 5))}</span>
        </div>

        <div class="panel">
            <span class="panel-title">Memory</span>
            <span class="value">{memory.toFixed(1)} GB</span>
            <span class="bar-track">{'░'.repeat(20)}</span>
            <span class="bar-fill">{'█'.repeat(Math.floor(memory / 8 * 20))}</span>
        </div>
    </div>

    <div class="panels">
        <div class="panel">
            <span class="panel-title">Requests</span>
            <span class="value-good">{requests.toLocaleString()}</span>
        </div>

        <div class="panel">
            <span class="panel-title">Errors</span>
            <span class={errors > 5 ? 'value-bad' : 'value'}>{errors}</span>
        </div>

        <div class="panel">
            <span class="panel-title">Uptime</span>
            <span class="value-good">{Math.floor(uptime / 60)}m {uptime % 60}s</span>
        </div>
    </div>

    <div class="status-row">
        <div class="status-item">
            <span class="label">Status:</span>
            <span class="value-good">● Online</span>
        </div>
        <div class="status-item">
            <span class="label">Region:</span>
            <span class="value">us-east-1</span>
        </div>
    </div>

    <div class="footer">Press Ctrl+C to exit — Updates every 1s</div>
</div>

<style>
    :root {
        --primary: cyan;
        --accent: yellow;
        --success: green;
        --danger: red;
        --muted: gray;
        --border: cyan;
    }

    .dashboard {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .header {
        text-align: center;
        font-weight: bold;
        color: var(--primary);
        border: double;
        border-color: var(--primary);
        padding: 0 2cell;
    }

    .panels {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    .panel {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        border: rounded;
        border-color: var(--border);
        padding: 1cell;
        gap: 1cell;
    }

    .panel-title {
        color: var(--muted);
        font-weight: bold;
    }

    .value {
        font-weight: bold;
        color: var(--accent);
    }

    .value-good {
        font-weight: bold;
        color: var(--success);
    }

    .value-bad {
        font-weight: bold;
        color: var(--danger);
    }

    .bar-track {
        color: var(--muted);
    }

    .bar-fill {
        color: var(--primary);
        font-weight: bold;
    }

    .status-row {
        display: flex;
        flex-direction: row;
        gap: 3cell;
    }

    .status-item {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .label {
        color: var(--muted);
    }

    .footer {
        opacity: dim;
        color: var(--muted);
        text-align: center;
    }
</style>
