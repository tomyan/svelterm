// Browser entry — the same App.svelte, standard Svelte DOM mount.
import { mount } from 'svelte'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })
