# UI Governance Charter v1 (music-daw-case)

> 目标：保证功能持续迭代的同时，UI 不再失控；新增功能不得破坏核心路径、信息架构与可发现性。

## 1. Governance Objectives

每次迭代必须同时满足：

1. **可发现（Discoverable）**：核心与高频功能 3 秒可定位。
2. **可预测（Predictable）**：同类功能进入同类入口，不允许“临时塞位”。
3. **可回归（Regressible）**：新增功能不影响核心任务路径（播放/编辑/导出）。

---

## 2. IA Layering Model (强制)

所有功能必须声明层级，未声明不得合并。

### L1 — Core Surface（常驻核心）
- 例：Transport（Play/Pause/Stop/Record）、主编辑操作、主导出入口。
- 规则：
  - 常显；
  - 可一跳触达；
  - 不能被浮层遮挡；
  - 不进入二级抽屉。

### L2 — Workflow Surface（高频工作流）
- 例：模板、常用工作流面板、常规效率操作。
- 规则：
  - 可在主界面保留入口；
  - 受“入口预算”限制；
  - 默认不打断 L1 操作。

### L3 — Advanced Surface（低频高级）
- 例：auto-fix、reference、诊断辅助、发布向导等。
- 规则：
  - 仅可进入统一面板系统（Panel/Drawer）；
  - 不得新增顶栏直出按钮；
  - 打开后不得拦截 L1 控件指针事件。

### L4 — Experimental/Debug（实验与调试）
- 规则：
  - 默认隐藏（feature flag / dev-only）；
  - 不得出现在用户主路径。

---

## 3. Entry Budget（入口预算）

用于约束“越迭代越堆积”问题。

- 顶栏 L1/L2 主按钮：**<= 8**
- 同屏高优先动作（可见、可点击）：**<= 12**
- 高级面板并发展开：**<= 1 主 + 1 辅**
- L1 控件遮挡容忍：**0**

> 超预算处理：先合并入口/降级层级，再允许新增。

---

## 4. Feature Intake Gate（功能接入门禁）

每个功能 PR 必须补齐以下信息：

- 功能目标（一句话）
- 目标人群与频次（高/中/低）
- IA 层级（L1-L4）
- 入口位置（具体区域）
- 是否影响 L1 核心路径
- 空态/失败态/加载态行为
- 对应 e2e 守门用例 ID

未补齐：不进入评审。

---

## 5. Interaction & Overlay Rules（交互/浮层规则）

1. 任何固定浮层不得拦截 L1 控件点击。
2. 预览类 UI（仅展示信息）默认 `pointer-events: none`；仅真实可交互子元素开启 pointer-events。
3. 浮层与 Panel 的 z-index 需在 token 中集中定义，禁止局部硬编码抢层。
4. 开启高级面板后，Transport 与导出主动作必须可达。

---

## 6. Test Governance（测试治理）

### 必备 e2e Guardrails（CI 强制）

1. **Core clickability guard**：核心控件可见且不被遮挡。
2. **Panel non-blocking guard**：打开 L3 面板时，L1 仍可操作。
3. **Entry budget guard**：顶栏按钮数量不超过预算。
4. **Layering guard**：L3/L4 功能不得出现在 L1 区域。

### 失败策略
- Guardrail 失败视为结构回归（非普通 UI 细节）
- 优先级：P1

---

## 7. Ownership & Process

- `src/ui-shell/**`, `src/transport/**`, `src/panels/**` 需要 UI Owner Review。
- 变更入口结构必须补 ADR（Architecture Decision Record）。
- 迭代节奏建议：
  - Feature Track 70%
  - Shell/Governance Track 30%

---

## 8. Weekly Metrics（每周治理指标）

1. 顶栏入口数量
2. e2e pointer interception 失败数
3. 核心路径通过率（play/edit/export）
4. 新功能入口返工率
5. 到达目标功能平均点击数

出现异常阈值时，自动生成治理任务，不允许只继续堆功能。
