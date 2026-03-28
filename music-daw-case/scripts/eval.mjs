#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const taskIdx = args.indexOf('--task')
const taskId = taskIdx >= 0 ? args[taskIdx + 1] : `task-${Date.now()}`

const root = process.cwd()
const outDir = resolve(root, 'reports/eval')
mkdirSync(outDir, { recursive: true })

function runStep(name, cmd) {
  try {
    const output = execSync(cmd, { cwd: root, stdio: 'pipe' }).toString()
    return { name, ok: true, output }
  } catch (err) {
    return {
      name,
      ok: false,
      output: `${err.stdout?.toString?.() || ''}\n${err.stderr?.toString?.() || ''}`.trim(),
    }
  }
}

const lint = runStep('lint', 'npm run lint')
const unit = runStep('test', 'npm run test')
const e2e = runStep('test:e2e', 'npm run test:e2e')
const build = runStep('build', 'npm run build')

const pass = lint.ok && unit.ok && e2e.ok && build.ok
const now = new Date().toISOString()

const report = `# Eval Report\n\n- Task ID: ${taskId}\n- Evaluator: harness/eval.mjs\n- Date: ${now}\n\n## Verdict\n\n- ${pass ? 'PASS' : 'FAIL'}\n\n## Evidence\n\n### lint (${lint.ok ? 'PASS' : 'FAIL'})\n\n\`\`\`\n${lint.output.slice(0, 4000)}\n\`\`\`\n\n### unit test (${unit.ok ? 'PASS' : 'FAIL'})\n\n\`\`\`\n${unit.output.slice(0, 4000)}\n\`\`\`\n\n### e2e test (${e2e.ok ? 'PASS' : 'FAIL'})\n\n\`\`\`\n${e2e.output.slice(0, 4000)}\n\`\`\`\n\n### build (${build.ok ? 'PASS' : 'FAIL'})\n\n\`\`\`\n${build.output.slice(0, 4000)}\n\`\`\`\n\n## Issues\n\n${pass ? '- 无阻塞问题。' : '- 见上方失败步骤输出。'}\n\n## Recommendation\n\n- ${pass ? 'merge' : 'fix and rerun'}\n`

const reportPath = resolve(outDir, `${taskId}.md`)
writeFileSync(reportPath, report)

console.log(`[harness:eval] task=${taskId}`)
console.log(`[harness:eval] report=${reportPath}`)
console.log(`[harness:eval] verdict=${pass ? 'PASS' : 'FAIL'}`)

if (!pass) process.exit(1)
