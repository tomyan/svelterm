<script>
    let todos = $state([
        { id: 1, text: 'Write integration tests', done: true },
        { id: 2, text: 'Build dashboard demo', done: true },
        { id: 3, text: 'Create todo app', done: false },
        { id: 4, text: 'Port Keyboard Hero', done: false },
    ])
    let nextId = $state(5)
    let inputText = $state('')
    let inputFocused = $state(false)

    function addTodo() {
        const text = inputText.trim()
        if (!text) return
        todos = [...todos, { id: nextId++, text, done: false }]
        inputText = ''
    }

    function toggleTodo(id) {
        todos = todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
    }

    function removeTodo(id) {
        todos = todos.filter(t => t.id !== id)
    }

    let remaining = $derived(todos.filter(t => !t.done).length)
</script>

<style>
    :root {
        --primary: cyan;
        --accent: yellow;
        --done: green;
        --danger: red;
        --muted: gray;
    }

    .app {
        display: flex;
        flex-direction: column;
        gap: 1cell;
        padding: 1cell 2cell;
    }

    .title {
        font-weight: bold;
        color: var(--primary);
        border: double;
        border-color: var(--primary);
        padding: 0 2cell;
        text-align: center;
    }

    .input-row {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .input-field {
        display: flex;
        flex-direction: row;
        flex-grow: 1;
        border: single;
        border-color: var(--muted);
        padding: 0 1cell;
    }

    .input-field-focused {
        display: flex;
        flex-direction: row;
        flex-grow: 1;
        border: single;
        border-color: var(--primary);
        padding: 0 1cell;
    }

    .input-label {
        color: var(--muted);
    }

    .input-text {
        color: white;
    }

    .cursor {
        color: var(--primary);
        font-weight: bold;
    }

    .add-btn {
        border: single;
        border-color: var(--muted);
        padding: 0 2cell;
    }

    .add-btn:focus {
        border-color: var(--primary);
        color: var(--primary);
        font-weight: bold;
    }

    .todo-list {
        display: flex;
        flex-direction: column;
        border: rounded;
        border-color: var(--muted);
        padding: 1cell;
    }

    .todo-item {
        display: flex;
        flex-direction: row;
        gap: 1cell;
    }

    .checkbox {
        color: var(--muted);
    }

    .checkbox-done {
        color: var(--done);
    }

    .todo-text {
        flex-grow: 1;
    }

    .todo-text-done {
        flex-grow: 1;
        text-decoration: line-through;
        opacity: dim;
    }

    .delete-btn {
        color: var(--danger);
    }

    .delete-btn:focus {
        font-weight: bold;
        color: var(--danger);
    }

    .status {
        color: var(--muted);
        opacity: dim;
    }

    .footer {
        color: var(--muted);
        opacity: dim;
        text-align: center;
    }
</style>

<div class="app">
    <div class="title">Todo List</div>

    <div class="input-row">
        <div class={inputFocused ? 'input-field-focused' : 'input-field'}>
            <span class="input-label">{'> '}</span>
            <span class="input-text">{inputText}</span>
            <span class="cursor">{'_'}</span>
        </div>
        <button class="add-btn" onclick={addTodo}>[Add]</button>
    </div>

    <div class="todo-list">
        {#each todos as todo (todo.id)}
            <div class="todo-item">
                <button
                    class={todo.done ? 'checkbox-done' : 'checkbox'}
                    onclick={() => toggleTodo(todo.id)}
                >{todo.done ? '☑' : '☐'}</button>
                <span class={todo.done ? 'todo-text-done' : 'todo-text'}>{todo.text}</span>
                <button class="delete-btn" onclick={() => removeTodo(todo.id)}>[×]</button>
            </div>
        {/each}
    </div>

    <span class="status">{remaining} of {todos.length} remaining</span>
    <span class="footer">Tab to navigate, Enter to toggle/click, Ctrl+C to exit</span>
</div>
