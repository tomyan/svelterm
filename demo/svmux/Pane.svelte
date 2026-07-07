<script>
    // Pane wiring after @svelterm/vt100's EmbeddedTerminalRegion (the
    // packaged component's relative .js imports don't resolve from npm,
    // so the essential ~50 lines live here against the core exports).
    import { Terminal, Attr } from '@svelterm/vt100'

    let { stream } = $props()

    const terminal = new Terminal(80, 24)
    let region = $state(undefined)

    // $effect, not onMount — onMount doesn't fire under the custom
    // renderer in the node target (the $effect below provably does)
    $effect(() => stream.onOutput((bytes) => terminal.write(bytes)))

    $effect(() => {
        if (!region) return
        region.setCellSource((col, row) => toSveltermCell(terminal.getCell(col, row)))
        const syncCursor = () => {
            const c = terminal.cursor
            region.setCursor({ col: c.col, row: c.row, visible: c.visible })
        }
        syncCursor()
        const previous = terminal.onChange
        terminal.onChange = () => {
            syncCursor()
            region.markDirty()
            previous?.()
        }
        return () => {
            terminal.onChange = previous
            region.setCursor(null)
        }
    })

    /** bind:this needs the newer fork; an action captures the node. */
    function captureRegion(node) {
        region = node
    }

    function onResize(event) {
        const { cols, rows } = event.data
        if (cols === terminal.cols && rows === terminal.rows) return
        terminal.resize(cols, rows)
        stream.resize(cols, rows)
    }

    function toSveltermCell(cell) {
        return {
            char: cell.char,
            fg: colorToString(cell.fg),
            bg: colorToString(cell.bg),
            bold: (cell.attrs & Attr.Bold) !== 0,
            italic: (cell.attrs & Attr.Italic) !== 0,
            underline: (cell.attrs & Attr.Underline) !== 0,
            strikethrough: (cell.attrs & Attr.Strikethrough) !== 0,
            dim: (cell.attrs & Attr.Dim) !== 0,
            inverse: (cell.attrs & Attr.Inverse) !== 0,
            hyperlink: cell.hyperlink,
        }
    }

    const ANSI_NAMES = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']

    function colorToString(color) {
        if (color.type === 'default') return 'default'
        if (color.type === 'rgb') return `rgb(${color.r},${color.g},${color.b})`
        if (color.index < 8) return ANSI_NAMES[color.index]
        if (color.index < 16) return 'bright' + ANSI_NAMES[color.index - 8]
        return xterm256ToHex(color.index)
    }

    function xterm256ToHex(index) {
        if (index >= 232) {
            const v = 8 + (index - 232) * 10
            return `rgb(${v},${v},${v})`
        }
        const i = index - 16
        const step = (n) => n === 0 ? 0 : 55 + n * 40
        return `rgb(${step(Math.floor(i / 36))},${step(Math.floor(i / 6) % 6)},${step(i % 6)})`
    }
</script>

<svt-region use:captureRegion onresize={onResize}></svt-region>
