# music-daw-case

一个用于 **Harness 工程开发 case** 的在线音乐编辑器 MVP（浏览器端 DAW）。

目标：复现 Anthropic 在博客中提到的「浏览器 DAW」方向，但保持实现足够轻量，便于在 OpenClaw 里反复迭代、评测和演进。

## 技术栈

- Vite
- React + TypeScript
- Web Audio API（浏览器原生）

## 功能（MVP 最小闭环）

- 4 轨时间轴（16 beats）
- 每轨可新增/删除 clip（矩形块）
- Transport：播放 / 暂停 / 停止
- BPM 设置（60~200）
- 每个 clip 可触发基础音源（sine / square）与固定音高
- 每轨音量控制（mixer 最小版）
- 主输出电平可视化（简单 meter）

## 本地运行

```bash
cd music-daw-case
pnpm install
pnpm run dev
```

打开终端输出里的本地地址（通常是 http://localhost:5173 ）。

## 构建验证

```bash
pnpm run build
```

## 测试

```bash
# 单元/行为测试（vitest）
pnpm run test

# e2e（playwright）
pnpm exec playwright install chromium
pnpm run test:e2e
```

## 维护态验证规范（建议默认流程）

```bash
# 开发前快速健康检查
pnpm run verify:preflight

# 提交前完整检查（含 e2e）
pnpm run verify:full

# 发布前/每日回归（含 harness 闭环）
pnpm run verify:ci
```

说明：
- `verify:preflight` = lint + unit + build
- `verify:full` = preflight + e2e
- `verify:ci` = full + harness:loop（自动产出 eval/judge/govern/summary/weekly/task-pack/next-plan）

## 发布门禁（固定规则）

- PR 到 `main` 必须通过 GitHub Action `quality-gate`（执行 `pnpm run verify:full`）
- 每日自动跑 `daily-verify-ci`（执行 `pnpm run verify:ci`）
- FAIL 才会触发提醒（workflow 自动创建 failure issue）

> 建议在仓库 Settings → Branch protection rules 中，把 `quality-gate / verify-full` 设为 Required status check。

## Harness 自动评测（v0.3）

```bash
# 单次任务评测
pnpm run harness:eval -- --task your-task-id
pnpm run harness:govern -- --task your-task-id

# 聚合与周报
pnpm run harness:aggregate
pnpm run harness:weekly

# 生成任务包 + 下一轮计划
pnpm run harness:task-pack
pnpm run harness:next-plan

# 独立评审 + 一键闭环
pnpm run harness:judge -- --task your-task-id
pnpm run harness:loop -- --task your-task-id
```

产物位置：
- `harness/metrics/summary.json`
- `harness/metrics/weekly-YYYY-MM-DD.md`
- `harness/metrics/judgements/<task-id>.json|md`
- `harness/task-packs/task-pack-YYYY-MM-DD.md`
- `plans/auto-next-YYYY-MM-DD.md`

## 交互说明

- 点击 `Play` 开始从头播放整个时间轴
- `Pause` 暂停当前播放
- `Stop` 停止并回到开头
- 每个 Track 可调节 Vol
- 点击 `+ Clip` 给轨道添加一个随机位置 clip
- 双击 clip 删除
- 播放中会禁用新增 clip 和 BPM 修改，避免调度冲突

## 数据结构（核心）

- `ProjectState`
  - `bpm`
  - `tracks: Track[]`
- `Track`
  - `id`
  - `name`
  - `volume`
  - `clips: Clip[]`
- `Clip`
  - `id`
  - `startBeat`
  - `lengthBeats`
  - `noteHz`
  - `wave`

## 已知限制

- clip 位置暂不支持拖拽编辑（当前通过随机新增快速验证闭环）
- 没有钢琴卷帘、和弦、量化、自动化曲线
- 音色仅基础振荡器，不含采样器/合成器参数面板
- 暂无项目持久化（刷新页面会重置）

## Harness 闭环（已加 v0.1）

新增目录与脚本：

- `plans/`：计划模板
- `reports/build/`：构建报告模板
- `reports/eval/`：评测报告模板
- `harness/`：规则、指标、变更日志
- `scripts/eval.mjs`：自动执行 lint + build，生成评测报告
- `scripts/govern.mjs`：根据评测结果生成 governor 改进建议

### 执行方式

```bash
# 1) 跑评测（输出到 reports/eval/<task-id>.md）
pnpm run harness:eval -- --task demo-task

# 2) 跑 governor（输出到 harness/metrics/<task-id>-governor.md）
pnpm run harness:govern -- --task demo-task
```

## 下一步演进建议（v0.2+）

1. 接入 Playwright 自动走查 UI（按钮流程、clip 增删、播放状态）
2. 增加音频行为断言（节拍对齐、峰值阈值、静音轨验证）
3. 将失败归因自动聚合为周报（失败类型分布、修复收益）
4. 用 OpenClaw cron 定时回归，形成持续质量扫描

这个项目可作为 OpenClaw 自进化 harness 的标准样本库之一，用于持续比较：
- 交付时长
- 自动通过率
- 回归缺陷率
- 规则增量效果
