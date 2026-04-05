<script>
    import { pollColorScheme } from '../../src/index.js'

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

    let mode = $state('auto')
    let darkTheme = $state(0)
    let lightTheme = $state(0)
    let detectedScheme = $state('dark')

    // Poll terminal background color every second
    const stopPolling = pollColorScheme(1000, (scheme) => {
        detectedScheme = scheme
    })

    let effectiveScheme = $derived(mode === 'auto' ? detectedScheme : mode)

    let themeClass = $derived(
        effectiveScheme === 'dark' ? darkThemes[darkTheme].key
        : lightThemes[lightTheme].key
    )

    let modeLabel = $derived(
        mode === 'auto' ? `auto (${detectedScheme})` : mode
    )

    let themeName = $derived(
        effectiveScheme === 'dark' ? darkThemes[darkTheme].name
        : lightThemes[lightTheme].name
    )

    function cycleMode() {
        if (mode === 'auto') mode = 'dark'
        else if (mode === 'dark') mode = 'light'
        else mode = 'auto'
    }

    function cycleTheme() {
        if (effectiveScheme === 'dark') {
            darkTheme = (darkTheme + 1) % darkThemes.length
        } else {
            lightTheme = (lightTheme + 1) % lightThemes.length
        }
    }
</script>

<style>
    /* --- Dark Themes --- */
    .dark-ocean {
        --bg: black; --fg: white;
        --primary: cyan; --secondary: #5599ff;
        --accent: yellow; --muted: gray;
        --success: green; --error: red;
        --border: cyan;
    }
    .dark-forest {
        --bg: black; --fg: white;
        --primary: #55dd55; --secondary: #88cc44;
        --accent: yellow; --muted: gray;
        --success: #44ff44; --error: #ff6666;
        --border: #55dd55;
    }
    .dark-sunset {
        --bg: black; --fg: white;
        --primary: #ff9933; --secondary: #ff6666;
        --accent: #ffcc33; --muted: gray;
        --success: #55dd55; --error: #ff4444;
        --border: #ff9933;
    }

    /* --- Light Themes --- */
    .light-paper {
        --bg: #eeeeee; --fg: #111111;
        --primary: #2244aa; --secondary: #4466cc;
        --accent: #886600; --muted: #666666;
        --success: #116611; --error: #cc1111;
        --border: #2244aa;
    }
    .light-sky {
        --bg: #eeeeff; --fg: #111111;
        --primary: #0077bb; --secondary: #3399cc;
        --accent: #cc6600; --muted: #666666;
        --success: #117744; --error: #cc1111;
        --border: #0077bb;
    }
    .light-rose {
        --bg: #ffeeee; --fg: #111111;
        --primary: #aa3366; --secondary: #cc5588;
        --accent: #774488; --muted: #666666;
        --success: #117744; --error: #cc1111;
        --border: #aa3366;
    }

    .app {
        display: flex;
        flex-direction: column;
        padding: 1cell 2cell;
        color: var(--fg);
        background-color: var(--bg);
        width: 100%;
        height: 100%;
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
        flex-direction: column;
    }

    .control-row {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .control-label {
        width: 20cell;
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

    .label { color: var(--muted); }
    .value { color: var(--accent); font-weight: bold; }

    .preview {
        display: flex;
        flex-direction: column;
        border: rounded;
        border-color: var(--border);
        padding: 1cell;
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

    .sw-primary { background-color: var(--primary); color: var(--bg); padding: 0 1cell; }
    .sw-secondary { background-color: var(--secondary); color: var(--bg); padding: 0 1cell; }
    .sw-accent { background-color: var(--accent); color: var(--bg); padding: 0 1cell; }
    .sw-success { background-color: var(--success); color: var(--bg); padding: 0 1cell; }
    .sw-error { background-color: var(--error); color: var(--bg); padding: 0 1cell; }
    .sw-muted { background-color: var(--muted); color: var(--bg); padding: 0 1cell; }

    .sample {
        display: flex;
        flex-direction: column;
        border: single;
        border-color: var(--border);
        padding: 0 1cell;
    }

    .s-heading { font-weight: bold; color: var(--primary); }
    .s-body { color: var(--fg); }
    .s-link { text-decoration: underline; color: var(--secondary); }
    .s-ok { color: var(--success); }
    .s-err { color: var(--error); }
    .s-dim { color: var(--muted); opacity: dim; }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>

<div class="app {themeClass}">
    <div class="header">Theme Switcher</div>

    <div class="controls">
        <div class="control-row">
            <span class="control-label"><span class="label">Mode: </span><span class="value">{modeLabel}</span></span>
            <button onclick={cycleMode}>Cycle Mode</button>
        </div>
        <div class="control-row">
            <span class="control-label"><span class="label">Theme: </span><span class="value">{themeName}</span></span>
            <button onclick={cycleTheme}>Cycle Theme</button>
        </div>
    </div>

    <div class="preview">
        <span class="preview-title">Color Palette</span>
        <div class="color-row">
            <span class="sw-primary"> primary </span>
            <span class="sw-secondary"> secondary </span>
            <span class="sw-accent"> accent </span>
            <span class="sw-success"> success </span>
            <span class="sw-error"> error </span>
            <span class="sw-muted"> muted </span>
        </div>
    </div>

    <div class="preview">
        <span class="preview-title">Sample UI</span>
        <div class="sample">
            <span class="s-heading">Dashboard</span>
            <span class="s-body">Everything is running smoothly.</span>
            <span class="s-link">View details</span>
            <span class="s-ok">● 3 services healthy</span>
            <span class="s-err">● 1 alert active</span>
            <span class="s-dim">Last updated 2 minutes ago</span>
        </div>
    </div>

    <span class="footer">Tab to focus buttons, Enter to cycle, Ctrl+C to exit</span>
</div>
