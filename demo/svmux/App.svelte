<script>
    import Pane from './Pane.svelte'
    import { keyEventToBytes } from '@svelterm/vt100'
    import { ptyStream, healSpawnHelper } from './pty-stream.js'

    healSpawnHelper()

    const command = process.env.SVELTERM_MUX_CMD ?? process.env.SHELL ?? 'bash'
    const args = process.env.SVELTERM_MUX_ARGS?.split(' ').filter(Boolean) ?? []

    const panes = [
        { id: 1, stream: ptyStream(command, args) },
        { id: 2, stream: ptyStream(command, args) },
    ]
    let active = $state(0)

    function onKeydown(e) {
        const k = e.data
        if (!k) return
        // Alt+1 / Alt+2 pick the pane; everything else goes to its shell
        if (k.meta && (k.key === '1' || k.key === '2')) {
            active = Number(k.key) - 1
            e.preventDefault()
            return
        }
        panes[active].stream.write(keyEventToBytes({
            key: k.key,
            ctrlKey: k.ctrl,
            altKey: k.meta,
            shiftKey: k.shift,
        }))
        e.preventDefault() // arrows/PageUp belong to the shell, not scrolling
    }
</script>

<div class="mux" onkeydown={onKeydown}>
    <div class="panes">
        {#each panes as pane, i (pane.id)}
            <div class={i === active ? 'pane active' : 'pane'}>
                <Pane stream={pane.stream} />
            </div>
        {/each}
    </div>
    <span class="status">pane {active + 1}/2 · Alt+1 / Alt+2 switch · Ctrl+C exits the mux</span>
</div>

<style>
    .mux {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .panes {
        display: flex;
        flex-direction: row;
        gap: 1cell;
        flex-grow: 1;
        overflow: hidden;
    }

    .pane {
        flex-grow: 1;
        border: single;
        border-color: gray;
        overflow: hidden;
    }

    .pane.active {
        border-color: cyan;
    }

    .status {
        color: gray;
    }
</style>
