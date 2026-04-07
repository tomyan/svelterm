import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DebugServer } from '../src/debug/server.js'
import { ConsoleDomain } from '../src/debug/console.js'

describe('DebugServer', () => {

    it('starts and accepts WebSocket connections', async () => {
        const server = new DebugServer(0)
        const consoleDomain = new ConsoleDomain(server)
        server.registerDomain('Console', consoleDomain)
        await server.start()

        const ws = new WebSocket(`ws://127.0.0.1:${server.actualPort}`)
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve()
            ws.onerror = () => reject(new Error('connect failed'))
            setTimeout(() => reject(new Error('timeout')), 2000)
        })

        assert.equal(server.connected, 1)

        const response = await new Promise<any>((resolve) => {
            ws.onmessage = (event) => resolve(JSON.parse(String(event.data)))
            ws.send(JSON.stringify({ id: 1, method: 'Console.getEntries', params: {} }))
        })

        assert.equal(response.id, 1)
        assert.ok(response.result.entries)

        ws.close()
        await new Promise(r => setTimeout(r, 50))
        server.stop()
    })

    it('receives console events', async () => {
        const server = new DebugServer(0)
        const consoleDomain = new ConsoleDomain(server)
        server.registerDomain('Console', consoleDomain)
        consoleDomain.start()
        await server.start()

        const ws = new WebSocket(`ws://127.0.0.1:${server.actualPort}`)
        await new Promise<void>((resolve) => { ws.onopen = () => resolve() })

        const events: any[] = []
        ws.onmessage = (event) => {
            const msg = JSON.parse(String(event.data))
            if (msg.method) events.push(msg)
        }

        console.log('debug test message')
        await new Promise(r => setTimeout(r, 50))

        assert.ok(events.length > 0)
        assert.equal(events[0].method, 'Console.messageAdded')
        assert.equal(events[0].params.entry.level, 'log')
        assert.ok(events[0].params.entry.args[0].includes('debug test message'))

        consoleDomain.stop()
        ws.close()
        await new Promise(r => setTimeout(r, 50))
        server.stop()
    })

    it('handles unknown domain', async () => {
        const server = new DebugServer(0)
        await server.start()

        const ws = new WebSocket(`ws://127.0.0.1:${server.actualPort}`)
        await new Promise<void>((resolve) => { ws.onopen = () => resolve() })

        const response = await new Promise<any>((resolve) => {
            ws.onmessage = (event) => resolve(JSON.parse(String(event.data)))
            ws.send(JSON.stringify({ id: 1, method: 'Fake.method', params: {} }))
        })

        assert.ok(response.error)
        assert.ok(response.error.message.includes('Unknown domain'))

        ws.close()
        await new Promise(r => setTimeout(r, 50))
        server.stop()
    })
})
