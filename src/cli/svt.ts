/**
 * svt — debug-protocol client. Connects to a `run(App, { debug: true })`
 * app's WebSocket server, sends one request, prints the JSON result.
 *
 *   svt tree                       # DOM.getDocument
 *   svt query '.card'              # DOM.querySelector
 *   svt style <nodeId>             # CSS.getComputedStyle
 *   svt box <nodeId>               # DOM.getBoxModel
 *   svt console                    # Console.getEntries
 *   svt raw DOM.getDocument '{}'   # any method + JSON params
 *
 *   --port <n>   debug server port (default 9444)
 */

import { WebSocket } from 'ws'

interface Command { method: string; params: Record<string, unknown> }

export async function runSvt(argv: string[]): Promise<void> {
    const { rest, port } = extractPort(argv)
    const command = buildCommand(rest)
    if (!command) {
        printUsage()
        process.exit(1)
    }
    const result = await request(port, command)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

function buildCommand(argv: string[]): Command | null {
    const [verb, ...args] = argv
    switch (verb) {
        case 'tree': return { method: 'DOM.getDocument', params: {} }
        case 'query': return { method: 'DOM.querySelector', params: { selector: args[0] } }
        case 'style': return { method: 'CSS.getComputedStyle', params: { nodeId: Number(args[0]) } }
        case 'box': return { method: 'DOM.getBoxModel', params: { nodeId: Number(args[0]) } }
        case 'console': return { method: 'Console.getEntries', params: { count: Number(args[0]) || 100 } }
        case 'raw': return { method: args[0], params: args[1] ? JSON.parse(args[1]) : {} }
        default: return null
    }
}

function request(port: number, command: Command): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`)
        const timer = setTimeout(() => { ws.close(); reject(new Error('timed out')) }, 3000)
        ws.on('open', () => ws.send(JSON.stringify({ id: 1, ...command })))
        ws.on('message', (data) => {
            clearTimeout(timer)
            const msg = JSON.parse(data.toString())
            ws.close()
            if (msg.error) reject(new Error(msg.error.message))
            else resolve(msg.result)
        })
        ws.on('error', () => {
            clearTimeout(timer)
            reject(new Error(`cannot connect on port ${port} — run the target app with run(App, { debug: true })`))
        })
    })
}

function extractPort(argv: string[]): { rest: string[]; port: number } {
    const rest: string[] = []
    let port = 9444
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--port') port = Number(argv[++i]) || port
        else rest.push(argv[i])
    }
    return { rest, port }
}

function printUsage(): void {
    console.error(`Usage: svt <command> [--port <n>]
  tree                 print the node tree
  query <selector>     find a node id by CSS selector
  style <nodeId>       computed style for a node
  box <nodeId>         layout box for a node
  console [count]      recent console entries
  raw <method> [json]  any protocol method with JSON params`)
}
