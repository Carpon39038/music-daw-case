#!/usr/bin/env node
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const evalDir = resolve(root, 'reports/eval')
const outDir = resolve(root, 'harness/metrics')
mkdirSync(outDir, { recursive: true })

const files = readdirSync(evalDir).filter((f) => f.endsWith('.md') && !f.startsWith('_template'))

const summary = {
  total: 0,
  pass: 0,
  fail: 0,
  failedSteps: {
    lint: 0,
    unit: 0,
    e2e: 0,
    build: 0,
  },
  tasks: [],
}

for (const file of files) {
  const content = readFileSync(resolve(evalDir, file), 'utf8')
  const taskIdMatch = content.match(/- Task ID: (.+)/)
  const verdictPass = content.includes('\n- PASS\n')

  summary.total += 1
  if (verdictPass) summary.pass += 1
  else summary.fail += 1

  const lintFail = content.includes('### lint (FAIL)')
  const unitFail = content.includes('### unit test (FAIL)')
  const e2eFail = content.includes('### e2e test (FAIL)')
  const buildFail = content.includes('### build (FAIL)')

  if (lintFail) summary.failedSteps.lint += 1
  if (unitFail) summary.failedSteps.unit += 1
  if (e2eFail) summary.failedSteps.e2e += 1
  if (buildFail) summary.failedSteps.build += 1

  summary.tasks.push({
    taskId: taskIdMatch?.[1]?.trim() || file.replace('.md', ''),
    verdict: verdictPass ? 'PASS' : 'FAIL',
    lintFail,
    unitFail,
    e2eFail,
    buildFail,
  })
}

const payload = {
  generatedAt: new Date().toISOString(),
  ...summary,
  passRate: summary.total ? Number((summary.pass / summary.total).toFixed(4)) : 0,
}

const outPath = resolve(outDir, 'summary.json')
writeFileSync(outPath, JSON.stringify(payload, null, 2))
console.log(`[harness:aggregate] summary=${outPath}`)
console.log(`[harness:aggregate] total=${payload.total} pass=${payload.pass} fail=${payload.fail} passRate=${payload.passRate}`)
