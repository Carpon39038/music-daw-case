#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const metricsPath = resolve(root, 'harness/metrics/summary.json')
const plansDir = resolve(root, 'plans')
mkdirSync(plansDir, { recursive: true })

if (!existsSync(metricsPath)) {
  console.error('summary.json not found. Run npm run harness:aggregate first.')
  process.exit(1)
}

const s = JSON.parse(readFileSync(metricsPath, 'utf8'))
const date = new Date().toISOString().slice(0, 10)
const taskId = `auto-next-${date}`

const topRisk = Object.entries(s.failedSteps || {})
  .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]

let focus = '提升高阶验证覆盖（UI + 音频运行时断言）'
const taskPackRef = `harness/task-packs/task-pack-${date}.md`
if (topRisk && topRisk[1] > 0) {
  const [step] = topRisk
  focus = `优先修复失败热点步骤：${step}`
}

const content = `# Auto Next Plan\n\n- Task ID: ${taskId}\n- Owner: OpenClaw\n- Date: ${date}\n- Source: harness/metrics/summary.json\n\n## 1) Goal\n\n根据最近评测结果，自动生成下一轮迭代计划，推动 harness 持续演进。\n\n## 2) Current Snapshot\n\n- Total eval runs: ${s.total}\n- PASS: ${s.pass}\n- FAIL: ${s.fail}\n- Pass rate: ${(Number(s.passRate || 0) * 100).toFixed(2)}%\n\n## 3) Focus\n\n- 本轮重点：${focus}\n\n## 4) Proposed Work Items\n\n- [ ] W1: 生成并执行任务包（见 ${taskPackRef}）\n- [ ] W2: 提升 e2e 覆盖（含异常路径）\n- [ ] W3: 增加音频 runtime 断言（非纯数学）\n- [ ] W4: Governor 输出可执行规则变更草案\n\n## 5) Acceptance Criteria\n\n- [ ] AC1: 新增至少 1 条高价值 e2e 用例并通过\n- [ ] AC2: 新增至少 1 条音频运行时断言并通过\n- [ ] AC3: 运行 npm run harness:eval -- --task ${taskId} 输出 PASS\n\n## 6) Rollback\n\n- 新增用例与脚本均可按文件级回滚，不影响主功能路径。\n`

const outPath = resolve(plansDir, `${taskId}.md`)
writeFileSync(outPath, content)
console.log(`[harness:next-plan] plan=${outPath}`)
