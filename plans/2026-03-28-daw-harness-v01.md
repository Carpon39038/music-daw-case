# Task Plan

- Task ID: daw-harness-v01
- Owner: OpenClaw
- Date: 2026-03-28

## 1) Goal

给 music-daw-case 补齐 harness v0.1 闭环（Planner/Builder/Evaluator/Governor）最小可执行骨架。

## 2) Scope

### In Scope
- 新增 plans/reports/harness/scripts 目录结构
- 新增计划/构建/评测模板
- 新增 eval 与 govern 脚本
- 新增 package.json 脚本入口
- 跑通一次 eval + govern

### Out of Scope
- Playwright 自动化
- 音频行为深度断言
- 自动周报聚合

## 3) Acceptance Criteria (可验证)

- [x] AC1: 能执行 `pnpm run harness:eval -- --task daw-harness-v01` 产出评测报告
- [x] AC2: 能执行 `pnpm run harness:govern -- --task daw-harness-v01` 产出 governor 建议
- [x] AC3: README 有 harness 使用说明

## 4) Risks / Dependencies

- 风险1：JSON 手改导致 package.json 语法错误
- 依赖1：pnpm、node 环境可用

## 5) Build Steps

1. 创建目录与模板
2. 增加 eval/govern 脚本
3. 更新 README 与 pnpm scripts
4. 执行闭环验证

## 6) Verification Plan

- `pnpm run harness:eval -- --task daw-harness-v01`
- `pnpm run harness:govern -- --task daw-harness-v01`

## 7) Rollback Plan

- 删除新增 harness 文件与 scripts 入口，恢复到前一提交
