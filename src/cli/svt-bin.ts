#!/usr/bin/env node
import { runSvt } from './svt.js'
runSvt(process.argv.slice(2)).catch((err) => {
    console.error(err.message ?? String(err))
    process.exit(1)
})
