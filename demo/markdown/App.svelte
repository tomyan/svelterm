<script>
    import { parseMarkdown, parseInline } from './parse.js'

    let { source = '' } = $props()

    const blocks = $derived(parseMarkdown(source))
</script>

{#snippet spans(text)}
    {#each parseInline(text) as s, k (k)}
        {#if s.kind === 'bold'}<strong>{s.text}</strong>
        {:else if s.kind === 'italic'}<em>{s.text}</em>
        {:else if s.kind === 'code'}<code>{s.text}</code>
        {:else if s.kind === 'link'}<a href={s.href}>{s.text}</a>
        {:else}{s.text}{/if}
    {/each}
{/snippet}

<div class="app">
<div class="viewport">
<div class="doc">
    {#each blocks as block, i (i)}
        {#if block.type === 'heading'}
            <span class={'h' + block.level}>{block.text}</span>
        {:else if block.type === 'para'}
            <span class="para">{@render spans(block.text)}</span>
        {:else if block.type === 'code'}
            <div class="code">
                {#each block.lines as line, j (j)}
                    <span class="code-line">{line === '' ? ' ' : line}</span>
                {/each}
            </div>
        {:else if block.type === 'list'}
            <div class="list">
                {#each block.items as item, j (j)}
                    <span class="item">{block.ordered ? `${j + 1}. ` : '• '}{@render spans(item)}</span>
                {/each}
            </div>
        {:else if block.type === 'quote'}
            <span class="quote">▎ {@render spans(block.text)}</span>
        {:else}
            <hr />
        {/if}
    {/each}
</div>
</div>
<span class="hint">↑/↓ · PageUp/PageDown · mouse wheel — Ctrl+C exits</span>
</div>

<style>
    :root {
        --heading: cyan;
        --accent: yellow;
        --muted: gray;
        --code: green;
    }

    .app {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 0 0 0 0;
    }

    .viewport {
        overflow: scroll;
        flex-grow: 1;
    }

    .doc {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .hint {
        color: var(--muted);
        padding: 0 2cell;
    }

    .h1 {
        font-weight: bold;
        color: var(--heading);
        text-transform: uppercase;
    }

    .h2 {
        font-weight: bold;
        color: var(--accent);
    }

    .h3 {
        font-weight: bold;
    }

    .code {
        display: flex;
        flex-direction: column;
        color: var(--code);
        padding: 0 1cell;
    }

    .code-line {
        white-space: pre;
    }

    .list {
        display: flex;
        flex-direction: column;
    }

    .quote {
        font-style: italic;
        color: var(--muted);
    }
</style>
