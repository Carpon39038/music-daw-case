# UI/交互迁移计划

将参考项目（/tmp/zip_inspect/zip/src/）的布局和交互模式逐步迁移到本项目。

## 迁移步骤（严格按顺序）

### Step 1: 状态管理迁移到 zustand ✅
- [x] 安装 zustand (`pnpm add zustand`)
- [x] 创建 src/store/useDAWStore.ts，参考 /tmp/zip_inspect/zip/src/store/useDAWStore.ts
- [x] 创建 src/types.ts，参考 /tmp/zip_inspect/zip/src/types.ts
- [x] App.tsx 中所有 useState 状态迁移到 zustand store
- [x] 保留 persist middleware（localStorage 持久化）
- [x] 保留 undo/redo (past/future)、copy/cut/paste
- [x] **不改动 UI 布局和组件结构**
- [x] 验证：69 e2e 全通过

### Step 2: AudioEngine 独立化 ✅
- [x] 创建 src/audio/AudioEngine.ts，参考 /tmp/zip_inspect/zip/src/audio/AudioEngine.ts
- [x] 包含：Reverb(ConvolverNode)、Delay、Distortion(WaveShaper)、Compressor、Filter、StereoPanner
- [x] App.tsx 中的播放逻辑迁移到 AudioEngine
- [x] **不改动 UI**
- [x] 验证：69 e2e 全通过

### Step 3: 组件拆分 ✅
- [x] 从 App.tsx 拆出 Transport.tsx
- [x] 从 App.tsx 拆出 TrackList.tsx
- [x] 从 App.tsx 拆出 Timeline.tsx
- [x] 从 App.tsx 拆出 Inspector.tsx
- [x] 从 App.tsx 拆出 Mixer.tsx
- [x] App.tsx 只做布局组合
- [x] **保持现有布局不变，只拆文件**
- [x] 验证：69 e2e 全通过

### Step 4: 布局重构 ✅
- [x] 改为标准 DAW 布局：顶部 Transport + 左侧 TrackList + 右侧 Timeline + 底部 Mixer + 右侧 Inspector
- [x] 全屏 h-screen，overflow hidden
- [x] Clip 用彩色背景（track.color）+ 波形 SVG 预览
- [x] 播放头三角形指示器
- [x] 时间线 header 显示小节编号
- [x] Loop 区域绿色半透明可视化
- [x] 验证：69 e2e 全通过（可能需要更新部分 test selectors）

### Step 5: 交互增强 ✅
- [x] 双击时间线创建 clip
- [x] Clip 跨轨道拖拽
- [x] Clip 右边缘拖拽调整 duration
- [x] Shift+点击多选 clip
- [x] 播放头可拖拽（点击时间线 header）
- [x] 键盘快捷键：Space/S/Ctrl+Z/C/V/X/Delete
- [x] 时间显示格式：MM:SS.ms (B{beat})
- [x] 验证：69 e2e + 8 新增测试 (77 total)

### Step 6: 效果器 UI ✅
- [x] Inspector 中 Track 效果器面板：Reverb/Delay/Distortion/Compressor/Filter
- [x] 每个效果器可启用/禁用 + 参数滑块
- [x] Track 声像(Pan)控制
- [x] 验证：全测试通过（77/77）

## 参考代码
- /tmp/zip_inspect/zip/src/ — 参考项目源码
- /tmp/zip_inspect/zip/src/types.ts — 类型定义
- /tmp/zip_inspect/zip/src/store/useDAWStore.ts — zustand store
- /tmp/zip_inspect/zip/src/audio/AudioEngine.ts — 音频引擎
- /tmp/zip_inspect/zip/src/components/ — 组件参考

## 约束
- 视觉遵循 DESIGN.md（黑+灰+绿）
- data-testid 保持兼容
- 每步独立 commit + push
- 每步必须 69 e2e 全通过
