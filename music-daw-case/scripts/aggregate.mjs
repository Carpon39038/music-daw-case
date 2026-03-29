#!/usr/bin/env node
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const evalDir = resolve(root, 'reports/eval')
const outDir = resolve(root, 'harness/metrics')
const judgementsDir = resolve(outDir, 'judgements')
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
  failureTaxonomy: {
    R3_rules_missing: 0,
    R4_toolchain_or_build: 0,
    R6_validation_gap: 0,
  },
  scoreSummary: {
    count: 0,
    avgTotal: null,
    maxTotal: null,
    latestTotal: null,
  },
  tasks: [],
}

const totals = []

for (const file of files) {
  const content = readFileSync(resolve(evalDir, file), 'utf8')
  const taskIdMatch = content.match(/- Task ID: (.+)/)
  const taskId = taskIdMatch?.[1]?.trim() || file.replace('.md', '')
  const verdictPass = content.includes('\n- PASS\n')

  summary.total += 1
  if (verdictPass) summary.pass += 1
  else summary.fail += 1

  const lintFail = content.includes('### lint (FAIL)')
  const unitFail = content.includes('### unit test (FAIL)')
  const e2eFail = content.includes('### e2e test (FAIL)')
  const buildFail = content.includes('### build (FAIL)')

  if (lintFail) {
    summary.failedSteps.lint += 1
    summary.failureTaxonomy.R3_rules_missing += 1
  }
  if (unitFail) {
    summary.failedSteps.unit += 1
    summary.failureTaxonomy.R6_validation_gap += 1
  }
  if (e2eFail) {
    summary.failedSteps.e2e += 1
    summary.failureTaxonomy.R6_validation_gap += 1
  }
  if (buildFail) {
    summary.failedSteps.build += 1
    summary.failureTaxonomy.R4_toolchain_or_build += 1
  }

  let totalScore = null
  const judgementPath = resolve(judgementsDir, `${taskId}.json`)
  if (existsSync(judgementPath)) {
    try {
      const j = JSON.parse(readFileSync(judgementPath, 'utf8'))
      if (typeof j?.total === 'number') {
        totalScore = j.total
        totals.push(totalScore)
      }
    } catch {
      // ignore malformed judgement files
    }
  }

  summary.tasks.push({
    taskId,
    verdict: verdictPass ? 'PASS' : 'FAIL',
    lintFail,
    unitFail,
    e2eFail,
    buildFail,
    totalScore,
  })
}

if (totals.length) {
  summary.scoreSummary.count = totals.length
  summary.scoreSummary.maxTotal = Math.max(...totals)
  summary.scoreSummary.latestTotal = totals[totals.length - 1]
  summary.scoreSummary.avgTotal = Number((totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2))
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
