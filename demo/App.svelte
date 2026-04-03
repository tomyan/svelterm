<script>
    let count = $state(0)
</script>

<style>
    .container {
        display: flex;
        flex-direction: column;
        gap: 1;
        padding: 1 2;
    }
    .title {
        color: cyan;
        font-weight: bold;
    }
    .counter {
        display: flex;
        flex-direction: row;
        gap: 2;
    }
    .count {
        color: yellow;
        font-weight: bold;
    }
    button {
        border: single;
        border-color: white;
        padding: 0 2;
    }
</style>

<div class="container">
    <span class="title">Svelterm — Interactive Demo</span>
    <div class="counter">
        <span>Count: </span>
        <span class="count">{count}</span>
    </div>
    <button onclick={() => count++}>Increment</button>
    <span>Tab to focus button, Enter to click</span>
</div>
