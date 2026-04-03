<script>
    let count = $state(0)
</script>

<style>
    .container {
        display: flex;
        flex-direction: row;
        gap: 2;
        padding: 1 2;
    }
    .box-a {
        width: 20;
        padding: 1;
        border: rounded;
        border-color: cyan;
        color: white;
    }
    .box-b {
        width: 20;
        padding: 1;
        border: single;
        border-color: magenta;
        color: white;
        font-weight: bold;
    }
    .title {
        color: cyan;
        font-weight: bold;
    }
</style>

<div>
    <span class="title">Svelterm — Borders Demo</span>
    <div class="container">
        <div class="box-a">
            <span>Rounded</span>
        </div>
        <div class="box-b">
            <span>Single</span>
        </div>
    </div>
</div>
