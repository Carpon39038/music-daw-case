#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const PROJECT_ROOT = process.cwd()
const SUMMARY_PATH = path.join(PROJECT_ROOT, 'harness/metrics/summary.json')
const MEMORY_STATE_PATH = '/Users/cc/.openclaw/workspace/memory/gh-actions-watch-music-daw.json'
const FAILURE_WORKFLOWS = new Set(['daily-verify-ci', 'quality-gate'])

function sh(cmd, { silent = false } = {}) {
  try {
    const out = execSync(cmd, {
      cwd: PROJECT_ROOT,
      stdio: silent ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    })
    return out.trim()
  } catch (err) {
    return ''
  }
}

function readJson(file, fallback = null) {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function getGitSignals() {
  sh('git fetch origin main --quiet', { silent: true })
  const head = sh('git rev-parse HEAD', { silent: true })
  const originMain = sh('git rev-parse origin/main', { silent: true })
  const dirty = sh('git status --porcelain', { silent: true })
  return {
    head,
    originMain,
    hasRemoteDelta: !!head && !!originMain && head !== originMain,
    hasLocalChanges: dirty.length > 0,
  }
}

async function getLatestFailureRun() {
  try {
    const res = await fetch('https://api.github.com/repos/Carpon39038/music-daw-case/actions/runs?per_page=20', {
      headers: { 'Accept': 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const runs = Array.isArray(data.workflow_runs) ? data.workflow_runs : []
    const failed = runs
      .filter((r) => FAILURE_WORKFLOWS.has(r.name) && r.conclusion === 'failure')
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    if (!failed.length) return null
    const top = failed[0]
    return {
      id: String(top.id),
      name: top.name,
      url: top.html_url,
      updated_at: top.updated_at,
    }
  } catch {
    return null
  }
}

function minutesSince(isoTime) {
  if (!isoTime) return Number.POSITIVE_INFINITY
  const ts = Date.parse(isoTime)
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY
  return (Date.now() - ts) / 60000
}

function latestOne(globPattern) {
  const out = sh(`ls -1t ${globPattern} 2>/dev/null | head -n 1`, { silent: true })
  return out || null
}

function printResult(result, lines) {
  console.log(JSON.stringify(result, null, 2))
  for (const line of lines) console.log(line)
}

function makeTaskId() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `daily-${y}-${m}-${d}-${hh}${mm}`
}

async function main() {
  const beforeSummary = readJson(SUMMARY_PATH, {}) || {}
  const beforePassRate = Number(beforeSummary.passRate ?? 0)
  const sinceLast = minutesSince(beforeSummary.generatedAt)

  const git = getGitSignals()
  const state = readJson(MEMORY_STATE_PATH, {}) || {}
  const latestFailure = await getLatestFailureRun()
  const lastSeenFailureId = state.last_seen_failure_run_id || null
  const hasNewFailureRun = !!latestFailure && latestFailure.id !== lastSeenFailureId

  const noNewCodeInput = !git.hasRemoteDelta && !git.hasLocalChanges
  if (noNewCodeInput && !hasNewFailureRun && sinceLast < 120) {
    const result = {
      task: null,
      status: 'NO_PROGRESS',
      total_runs: Number(beforeSummary.total ?? 0),
      pass_rate: Number(beforeSummary.passRate ?? 0),
      score: Number(beforeSummary.scoreSummary?.latestTotal ?? 0),
      failure_buckets_changed: false,
      artifacts: [SUMMARY_PATH],
      commit: null,
      BLOCKED_BY: 'No new signal since last run',
      NO_PROGRESS: '跳过重复执行以避免无效循环（<120分钟且无新代码/无新失败run）。',
    }
    printResult(result, [
      '本轮跳过：无新信号。',
      `距上次 summary 产出约 ${sinceLast.toFixed(1)} 分钟。`,
      '未执行 harness:loop。',
    ])
    return
  }

  const task = makeTaskId()
  const run = spawnSync('pnpm', ['run', 'harness:loop', '--', '--task', task], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  })
  if (run.status !== 0) {
    const result = {
      task,
      status: 'BLOCKED',
      total_runs: Number(beforeSummary.total ?? 0),
      pass_rate: Number(beforeSummary.passRate ?? 0),
      score: Number(beforeSummary.scoreSummary?.latestTotal ?? 0),
      failure_buckets_changed: false,
      artifacts: [],
      commit: null,
      BLOCKED_BY: 'harness:loop execution failed',
      NO_PROGRESS: '命令失败，需先修复执行环境或脚本错误。',
    }
    printResult(result, ['harness:loop 执行失败。'])
    process.exit(run.status ?? 1)
  }

  const afterSummary = readJson(SUMMARY_PATH, {}) || {}
  const afterPassRate = Number(afterSummary.passRate ?? 0)
  const latestScore = Number(afterSummary.scoreSummary?.latestTotal ?? 0)

  const weekly = latestOne('harness/metrics/weekly-*.md')
  const judgementJson = latestOne('harness/metrics/judgements/daily-*.json')
  const judgementMd = latestOne('harness/metrics/judgements/daily-*.md')
  const taskPack = latestOne('harness/task-packs/task-pack-*.md')
  const governor = latestOne('harness/metrics/daily-*-governor.md')

  const artifacts = [
    'harness/metrics/summary.json',
    weekly,
    judgementJson,
    judgementMd,
    taskPack,
    governor,
  ].filter(Boolean)

  const missingRequired = !weekly || !judgementJson || !taskPack || !governor
  if (missingRequired) {
    const result = {
      task,
      status: 'BLOCKED',
      total_runs: Number(afterSummary.total ?? 0),
      pass_rate: afterPassRate,
      score: latestScore,
      failure_buckets_changed: false,
      artifacts,
      commit: null,
      BLOCKED_BY: 'missing required artifacts',
      NO_PROGRESS: 'harness 产物不完整，需检查 aggregate/task-pack/govern 产出链路。',
    }
    printResult(result, ['执行完成但产物校验失败（BLOCKED）。'])
    return
  }

  const beforeBuckets = JSON.stringify(beforeSummary.failureTaxonomy || {})
  const afterBuckets = JSON.stringify(afterSummary.failureTaxonomy || {})
  const failureBucketsChanged = beforeBuckets !== afterBuckets

  const dirtyAfter = sh('git status --porcelain', { silent: true }).length > 0
  const improvement = afterPassRate - beforePassRate
  const isNoProgress = !dirtyAfter || improvement < 0.05

  const status = isNoProgress ? 'NO_PROGRESS' : 'PASS'
  const result = {
    task,
    status,
    total_runs: Number(afterSummary.total ?? 0),
    pass_rate: afterPassRate,
    score: latestScore,
    failure_buckets_changed: failureBucketsChanged,
    artifacts,
    commit: null,
    BLOCKED_BY: isNoProgress
      ? `metrics 改进不足阈值或无实质变更（delta=${(improvement * 100).toFixed(2)}%）`
      : null,
    NO_PROGRESS: isNoProgress
      ? '本轮有执行与产物，但未达到推进阈值（>=5%）。'
      : null,
  }

  if (latestFailure?.id) {
    writeJson(MEMORY_STATE_PATH, {
      ...state,
      last_seen_failure_run_id: latestFailure.id,
      last_seen_failure_name: latestFailure.name,
      last_seen_failure_url: latestFailure.url,
      last_seen_failure_updated_at: latestFailure.updated_at,
      updated_at: new Date().toISOString(),
    })
  }

  const lines = [
    `task=${task} 执行完成。`,
    `total_runs=${result.total_runs}, pass_rate=${(afterPassRate * 100).toFixed(2)}%, score=${latestScore}.`,
    `failure_buckets_changed=${failureBucketsChanged}.`,
    isNoProgress ? `NO_PROGRESS: ${result.NO_PROGRESS}` : '达到推进条件。',
  ]
  printResult(result, lines)
}

await main()
