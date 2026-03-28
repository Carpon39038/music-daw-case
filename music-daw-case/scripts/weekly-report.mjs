#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const metricsDir = resolve(root, 'harness/metrics')
mkdirSync(metricsDir, { recursive: true })

const summaryPath = resolve(metricsDir, 'summary.json')
if (!existsSync(summaryPath)) {
  console.error('summary.json not found. Run npm run harness:aggregate first.')
  process.exit(1)
}

const s = JSON.parse(readFileSync(summaryPath, 'utf8'))

const report = `# Weekly Harness Report\n\n- Generated At: ${new Date().toISOString()}\n\n## KPI Snapshot\n\n- Total eval runs: ${s.total}\n- PASS: ${s.pass}\n- FAIL: ${s.fail}\n- Pass rate: ${(s.passRate * 100).toFixed(2)}%\n\n## Failure Step Distribution\n\n- lint fail count: ${s.failedSteps.lint}\n- unit fail count: ${s.failedSteps.unit}\n- e2e fail count: ${s.failedSteps.e2e}\n- build fail count: ${s.failedSteps.build}\n\n## Task Results\n\n${s.tasks.map((t) => `- ${t.taskId}: ${t.verdict}`).join('\n')}\n\n## Governor Focus (Next Week)\n\n1. If e2e failures increase, stabilize selectors/test hooks first.\n2. If build failures increase, enforce prebuild type checks in PR flow.\n3. Keep improving audio assertions from math-level to runtime-level.\n\n`

const outPath = resolve(metricsDir, `weekly-${new Date().toISOString().slice(0, 10)}.md`)
writeFileSync(outPath, report)
console.log(`[harness:weekly] report=${outPath}`)
