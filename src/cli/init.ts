/**
 * svelterm init — scaffold a terminal app project:
 *
 *   npx svelterm init my-app
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function runInit(argv: string[]): void {
    const target = argv[0]
    if (!target) {
        console.error('Usage: svelterm init <directory>')
        process.exit(1)
    }
    const dir = path.resolve(target)
    try {
        scaffoldProject(dir)
    } catch (err) {
        console.error(err instanceof Error ? err.message : String(err))
        process.exit(1)
    }
    console.log(`Scaffolded ${path.basename(dir)}. Next:`)
    console.log(`  cd ${target}`)
    console.log('  # see README.md — svelterm needs the custom-renderer Svelte fork')
    console.log('  npm install && npm run dev')
}

/** Create the project files; throws if the directory has content. */
export function scaffoldProject(dir: string): void {
    if (existsSync(dir) && readdirSync(dir).length > 0) {
        throw new Error(`${dir} is not empty — refusing to scaffold over existing files`)
    }
    mkdirSync(path.join(dir, 'src'), { recursive: true })
    const name = path.basename(dir)
    for (const [file, content] of Object.entries(templates(name))) {
        writeFileSync(path.join(dir, file), content)
    }
}

function templates(name: string): Record<string, string> {
    return {
        'package.json': JSON.stringify({
            name,
            private: true,
            version: '0.0.0',
            type: 'module',
            scripts: {
                dev: 'vite dev',
                app: 'svelterm dev http://localhost:5173',
                build: 'svelterm build',
            },
            dependencies: {
                '@svelterm/core': '^0.4.0',
                // The custom-renderer Svelte branch — see the scaffolded README
                svelte: 'file:../svelte-fork/packages/svelte',
            },
            devDependencies: {
                rolldown: '^1.0.0',
                vite: '^7.0.0',
            },
        }, null, 4) + '\n',

        'vite.config.ts': `import { defineConfig } from 'vite'
import { svelterm } from '@svelterm/core/vite'

// Terminal-only app — svelterm's plugins compile .svelte for the
// terminal environment; no vite-plugin-svelte needed. (Dual-target
// browser + terminal setups do need it — see
// https://svelterm.dev/docs/getting-started.)
export default defineConfig({
    plugins: [
        ...svelterm.terminalServer({ entry: './src/App.svelte' }),
    ],
    environments: svelterm.environments(),
    optimizeDeps: { exclude: ['svelte'] },
    ssr: { noExternal: ['svelte'] },
})
`,

        'src/App.svelte': `<script>
    let count = $state(0)
</script>

<div class="app">
    <span class="title">${name}</span>
    <span>Count: <span class="value">{count}</span></span>
    <button onclick={() => count++}>Increment</button>
    <button onclick={() => count--}>Decrement</button>
</div>

<style>
    .app {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        border: rounded;
        border-color: cyan;
        padding: 1cell 2cell;
    }

    .title {
        font-weight: bold;
    }

    .value {
        color: yellow;
        font-weight: bold;
    }

    button {
        width: 20cell;
    }

    button:focus {
        color: cyan;
        font-weight: bold;
    }
</style>
`,

        'src/main.css': `/* Global styles — component <style> blocks layer on top. */
`,

        '.gitignore': `node_modules/
dist/
`,

        'README.md': `# ${name}

A terminal app built with [svelterm](https://svelterm.dev).

## Prerequisites

svelterm needs the Svelte custom-renderer branch (unmerged upstream).
Clone and build it as a sibling of this project:

\`\`\`bash
git clone -b svelte-custom-renderer https://github.com/tomyan/svelte.git ../svelte-fork
cd ../svelte-fork && pnpm install && pnpm -C packages/svelte build
\`\`\`

## Develop

\`\`\`bash
npm install
npm run dev    # vite dev server (terminal 1)
npm run app    # the app, in this terminal (terminal 2)
\`\`\`

Edits hot-reload; \`console.log\` output appears in the vite terminal.

## Ship

\`\`\`bash
npm run build  # → dist/app.mjs, runnable with plain node
node dist/app.mjs
\`\`\`
`,
    }
}
