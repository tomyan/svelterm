/**
 * Runtime domain — identifies the process behind the debug socket.
 * Harness clients use it to verify they are attached to the app they
 * spawned rather than an orphan from an earlier run holding the port.
 */

import type { DebugDomain } from './server.js'

export class RuntimeDomain implements DebugDomain {
    handle(method: string): any {
        if (method === 'info') {
            return { pid: process.pid, startedAt: Math.floor(process.uptime() * -1000) + Date.now() }
        }
        throw new Error(`Unknown Runtime method: ${method}`)
    }
}
