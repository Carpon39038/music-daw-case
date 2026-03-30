# Harness Loop (v0.1)

这个目录把 `music-daw-case` 变成一个可演进的开发 case。

## 四角色闭环

1. **Planner**：写计划与验收标准（`plans/*.md`）
2. **Builder**：按计划实现代码（本项目代码改动）
3. **Evaluator**：执行自动检查并产出评测报告（`reports/eval/*.md`）
4. **Governor**：根据失败样本沉淀规则（`harness/rules/*.md` + `harness/changelog.md`）

## 建议执行顺序

```bash
# 1) 先复制计划模板，填写需求
cp plans/_template.md plans/2026-03-28-daw-ui-improve.md

# 2) 实现功能后执行评测
pnpm run harness:eval -- --task 2026-03-28-daw-ui-improve

# 3) 汇总并更新进化建议
pnpm run harness:govern -- --task 2026-03-28-daw-ui-improve
```

## 输出位置

- 计划：`plans/*.md`
- 构建报告：`reports/build/*.md`
- 评测报告：`reports/eval/*.md`
- 规则与变更日志：
  - `harness/rules/*.md`
  - `harness/changelog.md`

## 说明

v0.1 先用轻量脚本建立流程骨架，后续可接入：
- Playwright 自动化 UI 走查
- 音频行为断言（峰值、节拍对齐）
- 多代理（Planner/Builder/Evaluator/Governor）自动编排
- OpenClaw cron 周期回归扫描
