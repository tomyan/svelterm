<script>
    const darkThemes = [
        { name: 'Ocean', key: 'dark-ocean' },
        { name: 'Forest', key: 'dark-forest' },
        { name: 'Sunset', key: 'dark-sunset' },
    ]
    const lightThemes = [
        { name: 'Paper', key: 'light-paper' },
        { name: 'Sky', key: 'light-sky' },
        { name: 'Rose', key: 'light-rose' },
    ]

    let mode = $state('dark')  // 'auto' | 'dark' | 'light'
    let darkTheme = $state(0)
    let lightTheme = $state(0)

    let themeClass = $derived(
        mode === 'dark' ? darkThemes[darkTheme].key
        : mode === 'light' ? lightThemes[lightTheme].key
        : 'auto'
    )

    let currentThemeName = $derived(
        mode === 'dark' ? darkThemes[darkTheme].name
        : mode === 'light' ? lightThemes[lightTheme].name
        : 'Auto'
    )

    function cycleMode() {
        if (mode === 'dark') mode = 'light'
        else if (mode === 'light') mode = 'auto'
        else mode = 'dark'
    }

    function cycleTheme() {
        if (mode === 'dark') darkTheme = (darkTheme + 1) % darkThemes.length
        else if (mode === 'light') lightTheme = (lightTheme + 1) % lightThemes.length
    }
</script>

<style>
    /* Dark themes */
    .dark-ocean {
        --bg: black;
        --fg: white;
        --primary: cyan;
        --secondary: blue;
        --accent: yellow;
        --muted: gray;
        --success: green;
        --error: red;
        --surface: #1a1a2e;
        --border: cyan;
    }

    .dark-forest {
        --bg: black;
        --fg: white;
        --primary: green;
        --secondary: #228b22;
        --accent: yellow;
        --muted: gray;
        --success: #32cd32;
        --error: red;
        --surface: #1a2e1a;
        --border: green;
    }

    .dark-sunset {
        --bg: black;
        --fg: white;
        --primary: #ff922b;
        --secondary: #ff6b6b;
        --accent: yellow;
        --muted: gray;
        --success: green;
        --error: #ff6b6b;
        --surface: #2e1a1a;
        --border: #ff922b;
    }

    /* Light themes */
    .light-paper {
        --bg: white;
        --fg: black;
        --primary: #4169e1;
        --secondary: #6495ed;
        --accent: #b8860b;
        --muted: gray;
        --success: #228b22;
        --error: #dc143c;
        --surface: #f5f5dc;
        --border: #4169e1;
    }

    .light-sky {
        --bg: white;
        --fg: black;
        --primary: #00bfff;
        --secondary: #87ceeb;
        --accent: #ff8c00;
        --muted: gray;
        --success: #2e8b57;
        --error: #dc143c;
        --surface: #f0f8ff;
        --border: #00bfff;
    }

    .light-rose {
        --bg: white;
        --fg: black;
        --primary: #db7093;
        --secondary: #ffb6c1;
        --accent: #8b008b;
        --muted: gray;
        --success: #2e8b57;
        --error: #dc143c;
        --surface: #fff0f5;
        --border: #db7093;
    }

    /* Auto mode inherits terminal defaults */
    .auto {
        --bg: black;
        --fg: white;
        --primary: cyan;
        --secondary: blue;
        --accent: yellow;
        --muted: gray;
        --success: green;
        --error: red;
        --surface: black;
        --border: cyan;
    }

    .app {
        display: flex;
        flex-direction: column;
        padding: 1cell 2cell;
        color: var(--fg);
    }

    .header {
        border: double;
        border-color: var(--border);
        padding: 0 2cell;
        text-align: center;
        font-weight: bold;
        color: var(--primary);
    }

    .controls {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    button {
        border: single;
        border-color: var(--muted);
        padding: 0 2cell;
        color: var(--fg);
    }

    button:focus {
        border-color: var(--primary);
        color: var(--primary);
        font-weight: bold;
    }

    .label {
        color: var(--muted);
    }

    .value {
        color: var(--accent);
        font-weight: bold;
    }

    .preview {
        display: flex;
        flex-direction: column;
        border: rounded;
        border-color: var(--border);
        padding: 1cell;
        gap: 1cell;
    }

    .preview-title {
        font-weight: bold;
        color: var(--primary);
    }

    .color-row {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .swatch-primary { background-color: var(--primary); color: var(--bg); padding: 0 1cell; }
    .swatch-secondary { background-color: var(--secondary); color: var(--bg); padding: 0 1cell; }
    .swatch-accent { background-color: var(--accent); color: var(--bg); padding: 0 1cell; }
    .swatch-success { background-color: var(--success); color: var(--bg); padding: 0 1cell; }
    .swatch-error { background-color: var(--error); color: var(--bg); padding: 0 1cell; }
    .swatch-muted { background-color: var(--muted); color: var(--bg); padding: 0 1cell; }

    .sample-panel {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: var(--border);
        padding: 0 1cell;
    }

    .sample-heading {
        font-weight: bold;
        color: var(--primary);
    }

    .sample-body {
        color: var(--fg);
    }

    .sample-link {
        text-decoration: underline;
        color: var(--secondary);
    }

    .sample-success {
        color: var(--success);
    }

    .sample-error {
        color: var(--error);
    }

    .sample-muted {
        color: var(--muted);
        opacity: dim;
    }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>

<div class="app {themeClass}">
    <div class="header">Theme Switcher</div>

    <div class="controls">
        <span><span class="label">Mode: </span><span class="value">{mode}</span></span>
        <button onclick={cycleMode} onfocus={() => {}} onblur={() => {}}>Cycle Mode</button>
        <span><span class="label">Theme: </span><span class="value">{currentThemeName}</span></span>
        <button onclick={cycleTheme} onfocus={() => {}} onblur={() => {}}>Cycle Theme</button>
    </div>

    <div class="preview">
        <span class="preview-title">Color Palette</span>
        <div class="color-row">
            <span class="swatch-primary"> primary </span>
            <span class="swatch-secondary"> secondary </span>
            <span class="swatch-accent"> accent </span>
            <span class="swatch-success"> success </span>
            <span class="swatch-error"> error </span>
            <span class="swatch-muted"> muted </span>
        </div>
    </div>

    <div class="preview">
        <span class="preview-title">Sample UI</span>
        <div class="sample-panel">
            <span class="sample-heading">Dashboard</span>
            <span class="sample-body">Everything is running smoothly.</span>
            <span class="sample-link">View details</span>
            <span class="sample-success">● 3 services healthy</span>
            <span class="sample-error">● 1 alert active</span>
            <span class="sample-muted">Last updated 2 minutes ago</span>
        </div>
    </div>

    <span class="footer">Tab to focus buttons, Enter to cycle, Ctrl+C to exit</span>
</div>
