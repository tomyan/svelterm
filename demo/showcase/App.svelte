<script>
    let inputValue = $state('')
</script>

<style>
    :root {
        --primary: cyan;
        --muted: gray;
    }

    @media (prefers-color-scheme: light) {
        :root {
            --primary: #0088aa;
            --muted: #666666;
        }
    }

    .showcase {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .title {
        font-weight: bold;
        color: var(--primary);
        border: double;
        border-color: var(--primary);
        padding: 0 2cell;
        text-align: center;
    }

    .section {
        display: flex;
        flex-direction: column;
    }

    .section-title {
        font-weight: bold;
        color: var(--primary);
    }

    .color-row {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .swatch-red { background-color: red; color: white; padding: 0 1cell; }
    .swatch-green { background-color: green; color: white; padding: 0 1cell; }
    .swatch-yellow { background-color: yellow; color: black; padding: 0 1cell; }
    .swatch-blue { background-color: blue; color: white; padding: 0 1cell; }
    .swatch-magenta { background-color: magenta; color: white; padding: 0 1cell; }
    .swatch-cyan { background-color: cyan; color: black; padding: 0 1cell; }
    .swatch-white { background-color: white; color: black; padding: 0 1cell; }

    .text-styles {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    .bold { font-weight: bold; }
    .italic { font-style: italic; }
    .underline { text-decoration: underline; }
    .strike { text-decoration: line-through; }
    .dim { opacity: dim; }
    .bold-italic { font-weight: bold; font-style: italic; }

    .borders-row {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    .border-single { border: single; padding: 0 1cell; width: 12cell; height: 3cell; text-align: center; }
    .border-double { border: double; padding: 0 1cell; width: 12cell; height: 3cell; text-align: center; }
    .border-rounded { border: rounded; padding: 0 1cell; width: 12cell; height: 3cell; text-align: center; }
    .border-heavy { border: heavy; padding: 0 1cell; width: 12cell; height: 3cell; text-align: center; }

    .color-fg-red { color: red; }
    .color-fg-green { color: green; }
    .color-fg-yellow { color: yellow; }
    .color-fg-blue { color: blue; }
    .color-fg-magenta { color: magenta; }
    .color-fg-cyan { color: cyan; }

    @media (prefers-color-scheme: light) {
        .color-fg-yellow { color: #997700; }
        .color-fg-green { color: #006600; }
        .color-fg-cyan { color: #007788; }
        .color-fg-red { color: #cc0000; }
    }

    .hex-demo { display: flex; flex-direction: row; gap: 1cell; }
    .hex-1 { color: #ff6b6b; }
    .hex-2 { color: #51cf66; }
    .hex-3 { color: #339af0; }
    .hex-4 { color: #fcc419; }
    .hex-5 { color: #cc5de8; }
    .hex-6 { color: #ff922b; }

    @media (prefers-color-scheme: light) {
        .hex-1 { color: #cc3333; }
        .hex-2 { color: #228833; }
        .hex-4 { color: #aa8800; }
    }

    .named-demo { display: flex; flex-direction: row; gap: 1cell; }
    .coral { color: coral; }
    .teal { color: teal; }
    .gold { color: gold; }
    .tomato { color: tomato; }
    .orchid { color: orchid; }
    .salmon { color: salmon; }

    @media (prefers-color-scheme: light) {
        .gold { color: #886600; }
        .salmon { color: #cc5544; }
    }

    .link { text-decoration: underline; color: #5599ff; }

    .layout-demo {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .layout-box {
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
        text-align: center;
    }

    .grow-1 { flex-grow: 1; }
    .grow-2 { flex-grow: 2; }
    .grow-3 { flex-grow: 3; }

    .align-demo {
        display: flex;
        flex-direction: row;
        gap: 2cell;
    }

    .left-align { text-align: left; width: 15cell; border: single; border-color: var(--muted); }
    .center-align { text-align: center; width: 15cell; border: single; border-color: var(--muted); }
    .right-align { text-align: right; width: 15cell; border: single; border-color: var(--muted); }

    .hover-demo {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .hover-item {
        border: single;
        border-color: var(--muted);
        padding: 0 2cell;
        color: var(--muted);
    }

    .hover-item:hover {
        border-color: var(--primary);
        color: var(--primary);
        font-weight: bold;
    }

    .truncate-demo {
        display: flex;
        flex-direction: column;
    }

    .truncate-box {
        width: 30cell;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
    }

    .input-demo {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    input {
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
        width: 30cell;
    }

    input:focus {
        border-color: var(--primary);
    }

    .input-echo {
        color: var(--muted);
    }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>

<div class="showcase">
    <div class="title">Svelterm Style Showcase</div>

    <div class="section">
        <span class="section-title">ANSI Colors (Background)</span>
        <div class="color-row">
            <span class="swatch-red"> red </span>
            <span class="swatch-green"> green </span>
            <span class="swatch-yellow"> yellow </span>
            <span class="swatch-blue"> blue </span>
            <span class="swatch-magenta"> magenta </span>
            <span class="swatch-cyan"> cyan </span>
            <span class="swatch-white"> white </span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Foreground Colors</span>
        <div class="color-row">
            <span class="color-fg-red">Red</span>
            <span class="color-fg-green">Green</span>
            <span class="color-fg-yellow">Yellow</span>
            <span class="color-fg-blue">Blue</span>
            <span class="color-fg-magenta">Magenta</span>
            <span class="color-fg-cyan">Cyan</span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Truecolor (24-bit Hex)</span>
        <div class="hex-demo">
            <span class="hex-1">#ff6b6b</span>
            <span class="hex-2">#51cf66</span>
            <span class="hex-3">#339af0</span>
            <span class="hex-4">#fcc419</span>
            <span class="hex-5">#cc5de8</span>
            <span class="hex-6">#ff922b</span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">CSS Named Colors</span>
        <div class="named-demo">
            <span class="coral">coral</span>
            <span class="teal">teal</span>
            <span class="gold">gold</span>
            <span class="tomato">tomato</span>
            <span class="orchid">orchid</span>
            <span class="salmon">salmon</span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Text Decorations</span>
        <div class="text-styles">
            <span class="bold">Bold</span>
            <span class="italic">Italic</span>
            <span class="underline">Underline</span>
            <span class="strike">Strike</span>
            <span class="dim">Dim</span>
            <span class="bold-italic">Bold+Italic</span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Border Styles</span>
        <div class="borders-row">
            <div class="border-single"><span>single</span></div>
            <div class="border-double"><span>double</span></div>
            <div class="border-rounded"><span>rounded</span></div>
            <div class="border-heavy"><span>heavy</span></div>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Hyperlinks</span>
        <a class="link" href="https://github.com">GitHub (OSC 8)</a>
    </div>

    <div class="section">
        <span class="section-title">Flex Layout (grow ratios 1:2:3)</span>
        <div class="layout-demo">
            <div class="layout-box grow-1"><span>1fr</span></div>
            <div class="layout-box grow-2"><span>2fr</span></div>
            <div class="layout-box grow-3"><span>3fr</span></div>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Text Alignment</span>
        <div class="align-demo">
            <div class="left-align"><span>left</span></div>
            <div class="center-align"><span>center</span></div>
            <div class="right-align"><span>right</span></div>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Hover (move mouse over items)</span>
        <div class="hover-demo">
            <span class="hover-item">Item A</span>
            <span class="hover-item">Item B</span>
            <span class="hover-item">Item C</span>
            <span class="hover-item">Item D</span>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Text Overflow (ellipsis)</span>
        <div class="truncate-demo">
            <div class="truncate-box"><span>/Users/tom/projects/svelterm/src/render/incremental-paint.ts</span></div>
        </div>
    </div>

    <div class="section">
        <span class="section-title">Text Input (Tab to focus, type to edit)</span>
        <div class="input-demo">
            <input value="" oninput={(e) => inputValue = e.data?.value ?? ''} />
            <span class="input-echo">Echo: {inputValue}</span>
        </div>
    </div>

    <span class="footer">Tab / Shift+Tab to navigate, mouse hover, Ctrl+C to exit</span>
</div>
