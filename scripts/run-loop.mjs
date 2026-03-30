#!/usr/bin/env node
import { execSync } from 'node:child_process'

const args = process.argv.slice(2)
const taskIdx = args.indexOf('--task')
const taskId = taskIdx >= 0 ? args[taskIdx + 1] : `loop-${Date.now()}`

const steps = [
  `pnpm run harness:eval -- --task ${taskId}`,
  `pnpm run harness:judge -- --task ${taskId}`,
  `pnpm run harness:govern -- --task ${taskId}`,
  'pnpm run harness:aggregate',
  'pnpm run harness:task-pack',
  'pnpm run harness:next-plan',
  'pnpm run harness:weekly',
]

for (const cmd of steps) {
  console.log(`[harness:loop] running: ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

console.log(`[harness:loop] done task=${taskId}`)
