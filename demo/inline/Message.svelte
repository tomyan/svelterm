<script>
    let { role, text, streaming = false } = $props()
</script>

<div class="message" class:user={role === 'user'}>
    <span class="role">{role === 'user' ? '>' : '•'}</span>
    <span class="text">{text}{#if streaming}<span class="ellipsis">…</span>{/if}</span>
</div>

<style>
    .message {
        display: flex;
        gap: 1cell;
        padding: 0 1cell;
    }

    .user .text {
        color: cyan;
        font-weight: bold;
    }

    .role {
        color: yellow;
    }

    .ellipsis {
        color: magenta;
    }
</style>
