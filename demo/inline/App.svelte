<script>
    import { createFrameLog } from '../../src/index.js'
    import Message from './Message.svelte'

    let turn = $state(0)
    let archivedCount = $state(0)

    const PROMPTS = [
        'explain the renderer',
        'now the layout engine',
        'and the css cascade',
        'what about input?',
        'how do frames archive?',
    ]
    const RESPONSE = 'Words stream into this frame one at a time, then the whole turn is archived into real terminal scrollback and its components are freed.'

    function runSession(logEl) {
        const log = createFrameLog(logEl)
        let stopped = false

        async function tick(ms) {
            return new Promise(resolve => setTimeout(resolve, ms))
        }

        async function session() {
            for (const prompt of PROMPTS) {
                if (stopped) return
                turn += 1
                log.append(Message, { role: 'user', text: prompt })
                const props = $state({ role: 'assistant', text: '', streaming: true })
                const responseId = log.append(Message, props)
                for (const word of RESPONSE.split(' ')) {
                    if (stopped) return
                    props.text = props.text ? `${props.text} ${word}` : word
                    await tick(60)
                }
                props.streaming = false
                await tick(700)
                log.archive(responseId)
                archivedCount += 2
            }
        }
        // Start outside the attachment's tracked scope — session() writes
        // state the surrounding effect must not depend on.
        const start = setTimeout(session, 0)
        return () => { stopped = true; clearTimeout(start) }
    }
</script>

<div class="app">
    <div class="log" {@attach runSession}></div>
    <div class="status">turn {turn}/5 · {archivedCount} frames archived · Ctrl+C to exit</div>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
    }

    .status {
        color: magenta;
        border: single;
        border-color: magenta;
        padding: 0 1cell;
        width: 60cell;
    }
</style>
