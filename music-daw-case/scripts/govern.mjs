#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const taskIdx = args.indexOf('--task')
const taskId = taskIdx >= 0 ? args[taskIdx + 1] : null

if (!taskId) {
  console.error('Usage: npm run harness:govern -- --task <task-id>')
  process.exit(1)
}

const reportPath = resolve(process.cwd(), 'reports/eval', `${taskId}.md`)
if (!existsSync(reportPath)) {
  console.error(`Eval report not found: ${reportPath}`)
  process.exit(1)
}

const content = readFileSync(reportPath, 'utf8')
const failedLint = content.includes('### lint (FAIL)')
const failedUnit = content.includes('### unit test (FAIL)')
const failedE2E = content.includes('### e2e test (FAIL)')
const failedBuild = content.includes('### build (FAIL)')

const suggestions = []
if (failedLint) suggestions.push('- R3 规则缺失：补充 ESLint 规则或代码风格自动修复流程。')
if (failedBuild) suggestions.push('- R4 工具链问题：检查 TS 类型错误与构建脚本；补充 prebuild 校验。')
if (failedUnit) suggestions.push('- R6 验证缺口（unit）：优先补充核心纯函数与边界输入断言。')
if (failedE2E) suggestions.push('- R6 验证缺口（e2e）：优先加稳 data-testid 与关键用户路径回归用例。')
if (!failedLint && !failedUnit && !failedE2E && !failedBuild) {
  suggestions.push('- 本轮通过：继续提升高阶验证覆盖，并保持失败分类映射稳定。')
}

const out = `# Governor Notes\n\n- Task ID: ${taskId}\n- Date: ${new Date().toISOString()}\n\n## Derived Signals\n\n- lint failed: ${failedLint}\n- unit failed: ${failedUnit}\n- e2e failed: ${failedE2E}\n- build failed: ${failedBuild}\n\n## Suggested Evolutions\n\n${suggestions.join('\n')}\n\n## Next Action\n\n- 将以上建议转化为可执行规则（lint/test/docs）并在下一轮任务验证。\n`

const outPath = resolve(process.cwd(), 'harness/metrics', `${taskId}-governor.md`)
writeFileSync(outPath, out)

console.log(`[harness:govern] notes=${outPath}`)
