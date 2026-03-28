#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const metricsPath = resolve(root, 'harness/metrics/summary.json')
const evalDir = resolve(root, 'reports/eval')
const outDir = resolve(root, 'harness/task-packs')
mkdirSync(outDir, { recursive: true })

if (!existsSync(metricsPath)) {
  console.error('summary.json not found. Run npm run harness:aggregate first.')
  process.exit(1)
}

const s = JSON.parse(readFileSync(metricsPath, 'utf8'))
const date = new Date().toISOString().slice(0, 10)
const packId = `task-pack-${date}`

const topRiskEntry = Object.entries(s.failedSteps || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]
const [topRisk, topRiskCount] = topRiskEntry || ['none', 0]

const latestEval = (() => {
  const files = readdirSync(evalDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_template'))
    .sort()
  if (files.length === 0) return ''
  return readFileSync(resolve(evalDir, files[files.length - 1]), 'utf8')
})()

const checksByRisk = {
  lint: [
    '补充 ESLint 规则：禁止未使用变量、禁止 any（关键路径）',
    '在 PR 流程中增加 npm run lint 为必过门禁',
    '新增至少 1 条针对历史 lint 失败的回归样例',
  ],
  unit: [
    '补充失败模块的边界测试与异常分支测试',
    '将纯函数逻辑前移并提高可测试性',
    '保证 npm run test 在本地与 CI 一致',
  ],
  e2e: [
    '统一 data-testid 命名规范并补全关键路径选择器',
    '补充至少 2 条异常流程 e2e（非法输入/状态切换）',
    '将 flaky 检查加入回归（重复执行 3 次）',
  ],
  build: [
    '增加 prebuild 类型检查并在失败时快速定位文件',
    '修复 tsconfig 与构建目标不一致问题',
    '对构建产物大小增加阈值检查',
  ],
  none: [
    '当前无失败热点：提升覆盖深度（音频运行时行为 + e2e 异常路径）',
    '将 governor 建议转为可执行规则（lint/test/docs）',
    '准备下一轮压力任务（更长流程、更高复杂度）',
  ],
}

const checks = checksByRisk[topRisk] || checksByRisk.none

const evidence = []
if (latestEval.includes('### e2e test (FAIL)')) evidence.push('最近一次评测包含 e2e 失败')
if (latestEval.includes('### build (FAIL)')) evidence.push('最近一次评测包含 build 失败')
if (latestEval.includes('### unit test (FAIL)')) evidence.push('最近一次评测包含 unit 失败')
if (latestEval.includes('### lint (FAIL)')) evidence.push('最近一次评测包含 lint 失败')
if (evidence.length === 0) evidence.push('最近一次评测无失败，任务包以增强覆盖为主')

const content = `# Harness Task Pack\n\n- Pack ID: ${packId}\n- Date: ${date}\n- Source: harness/metrics/summary.json\n\n## 1) Hotspot\n\n- top risk step: ${topRisk}\n- fail count: ${topRiskCount}\n- pass rate: ${(Number(s.passRate || 0) * 100).toFixed(2)}%\n\n## 2) Evidence\n\n${evidence.map((x) => `- ${x}`).join('\n')}\n\n## 3) Actionable Task Checklist\n\n${checks.map((x, i) => `- [ ] T${i + 1}: ${x}`).join('\n')}\n\n## 4) Definition of Done\n\n- [ ] npm run harness:eval -- --task ${packId} 结果 PASS\n- [ ] 产出对应 build/eval 报告\n- [ ] governor 给出下一轮可执行建议\n\n## 5) Rollback\n\n- 脚本与测试改动可按文件级回滚，避免影响主功能路径。\n`

const outPath = resolve(outDir, `${packId}.md`)
writeFileSync(outPath, content)
console.log(`[harness:task-pack] pack=${outPath}`)
