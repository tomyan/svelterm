import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DebugServer } from '../src/debug/server.js'
import { InputDomain } from '../src/debug/input.js'
import { ScreenDomain } from '../src/debug/screen.js'
import { connect, type Harness } from '../src/debug/harness.js'
import { CellBuffer } from '../src/render/buffer.js'
import { parseKeyEvent } from '../src/input/keyboard.js'
import { parseMouseEvent } from '../src/input/mouse.js'

function bufferWith(text: string): CellBuffer {
    const buffer = new CellBuffer(20, 2)
    for (let i = 0; i < text.length; i++) buffer.setCell(i, 0, { char: text[i] })
    return buffer
}

interface Rig {
    harness: Harness
    keys: Buffer[]
    mice: Buffer[]
    pastes: string[]
    setScreen: (text: string) => void
    stop: () => void
}

async function rig(): Promise<Rig> {
    const keys: Buffer[] = []
    const mice: Buffer[] = []
    const pastes: string[] = []
    let screen = bufferWith('initial')
    const server = new DebugServer(0)
    server.registerDomain('Input', new InputDomain({
        key: data => { keys.push(Buffer.from(data)) },
        mouse: data => { mice.push(Buffer.from(data)) },
        paste: text => { pastes.push(text) },
    }))
    server.registerDomain('Screen', new ScreenDomain({
        displayBuffer: () => screen,
        renderPending: () => false,
    }))
    await server.start()
    const harness = await connect({ port: server.actualPort })
    return {
        harness, keys, mice, pastes,
        setScreen: text => { screen = bufferWith(text) },
        stop: () => { harness.close(); server.stop() },
    }
}

describe('debug harness', () => {

    it('key sends a chord through the Input domain and settles', async () => {
        // Given
        const r = await rig()

        // When
        await r.harness.key('w', { ctrl: true })

        // Then
        assert.equal(r.keys.length, 1)
        assert.deepEqual(parseKeyEvent(r.keys[0]),
            { key: 'w', ctrl: true, shift: false, meta: false })
        r.stop()
    })

    it('text types characters', async () => {
        const r = await rig()
        await r.harness.text('hi')
        assert.equal(r.keys.length, 2)
        r.stop()
    })

    it('click sends press then release at the cell', async () => {
        const r = await rig()
        await r.harness.click(4, 1)
        assert.equal(r.mice.length, 2)
        assert.deepEqual(parseMouseEvent(r.mice[0]),
            { button: 'left', type: 'press', col: 4, row: 1 })
        assert.deepEqual(parseMouseEvent(r.mice[1]),
            { button: 'left', type: 'release', col: 4, row: 1 })
        r.stop()
    })

    it('doubleClick sends two click pairs', async () => {
        const r = await rig()
        await r.harness.doubleClick(4, 1)
        assert.equal(r.mice.length, 4)
        r.stop()
    })

    it('paste delivers text', async () => {
        const r = await rig()
        await r.harness.paste('clip')
        assert.deepEqual(r.pastes, ['clip'])
        r.stop()
    })

    it('screenText returns the displayed frame', async () => {
        const r = await rig()
        const text = await r.harness.screenText()
        assert.match(text, /^initial/)
        r.stop()
    })

    it('cellAt returns a cell record', async () => {
        const r = await rig()
        const cell = await r.harness.cellAt(0, 0)
        assert.equal(cell.char, 'i')
        r.stop()
    })

    it('waitForText polls until the screen matches', async () => {
        // Given — the screen changes shortly after the wait begins
        const r = await rig()
        setTimeout(() => r.setScreen('hello later'), 60)

        // When
        const text = await r.harness.waitForText('later', 2000)

        // Then
        assert.match(text, /later/)
        r.stop()
    })

    it('waitForText rejects on timeout', async () => {
        const r = await rig()
        await assert.rejects(r.harness.waitForText('never appears', 150), /never appears/)
        r.stop()
    })

    it('connect with a pid verifies the process behind the socket', async () => {
        // Given — a server reporting this process's pid
        const server = new DebugServer(0)
        server.registerDomain('Runtime', { handle: () => ({ pid: process.pid }) })
        await server.start()

        // Then — the right pid connects, a wrong pid fails loudly
        const ok = await connect({ port: server.actualPort, pid: process.pid })
        ok.close()
        await assert.rejects(
            connect({ port: server.actualPort, pid: process.pid + 1 }),
            /orphaned app/,
        )
        server.stop()
    })

    it('connect retries until the server is listening', async () => {
        // Given — a server that starts only after connect() begins retrying
        const server = new DebugServer(0)
        server.registerDomain('Screen', new ScreenDomain({
            displayBuffer: () => bufferWith('late'),
            renderPending: () => false,
        }))
        const startedAt = 9600 + Math.floor(Math.random() * 200)
        setTimeout(() => { (server as any).port = startedAt; server.start() }, 150)

        // When
        const harness = await connect({ port: startedAt, timeoutMs: 3000 })

        // Then
        assert.match(await harness.screenText(), /late/)
        harness.close()
        server.stop()
    })
})
