import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { FrameLog, registerInlineHooks } from '../src/framelog.js'
import { TermNode } from '../src/renderer/node.js'

/** A fake component: a function that builds nodes into its target. */
function textFrame(text: string) {
    return { render: (target: TermNode) => {
        const node = new TermNode('text', text)
        target.insertBefore(node, null)
    } }
}

function makeLog() {
    const host = new TermNode('element', 'root')
    const unmounted: object[] = []
    const log = new FrameLog(host, {
        mount: (component: any, opts: any) => {
            component.render(opts.target)
            return { component }
        },
        unmount: (app: object) => { unmounted.push(app) },
        renderer: {},
    })
    return { host, log, unmounted }
}

describe('FrameLog append and update', () => {

    it('mounts each frame into its own container under the host', () => {
        // Given
        const { host, log } = makeLog()

        // When
        const first = log.append(textFrame('one'), {})
        const second = log.append(textFrame('two'), {})

        // Then
        assert.equal(host.children.length, 2)
        assert.equal(first, 1)
        assert.equal(second, 2)
        assert.deepEqual(log.liveFrames(), [1, 2])
    })

    it('update assigns onto the props object passed at append', () => {
        // Given
        const { log } = makeLog()
        const props = { content: '' }
        const id = log.append(textFrame('x'), props)

        // When
        log.update(id, { content: 'streaming...' })

        // Then
        assert.equal(props.content, 'streaming...')
    })

    it('update of an unknown frame throws', () => {
        const { log } = makeLog()
        assert.throws(() => log.update(99, {}), /no live frame/)
    })
})

describe('FrameLog archive', () => {

    it('releases the archived rows and unmounts everything up to the id', () => {
        // Given
        const { host, log, unmounted } = makeLog()
        const released: number[] = []
        registerInlineHooks(host, { releaseTop: n => released.push(n) })

        const a = log.append(textFrame('a'), {})
        const b = log.append(textFrame('b'), {})
        log.append(textFrame('c'), {})
        host.children[0].cache.layoutBox = { x: 0, y: 0, width: 10, height: 2 } as any
        host.children[1].cache.layoutBox = { x: 0, y: 2, width: 10, height: 3 } as any

        // When: archiving b covers a too
        log.archive(b)

        // Then
        assert.deepEqual(released, [5])
        assert.equal(unmounted.length, 2)
        assert.equal(host.children.length, 1)
        assert.deepEqual(log.liveFrames(), [3])
        void a
    })

    it('archive of an unknown frame throws', () => {
        const { log } = makeLog()
        assert.throws(() => log.archive(1), /no live frame/)
    })
})

describe('FrameLog remove', () => {

    it('removes a single frame and keeps the others', () => {
        // Given
        const { host, log, unmounted } = makeLog()
        log.append(textFrame('a'), {})
        const b = log.append(textFrame('b'), {})
        log.append(textFrame('c'), {})

        // When
        log.remove(b)

        // Then
        assert.equal(host.children.length, 2)
        assert.equal(unmounted.length, 1)
        assert.deepEqual(log.liveFrames(), [1, 3])
    })
})
