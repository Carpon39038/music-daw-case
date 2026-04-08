# 🎯 music-daw-case 产品文档

> **定位**：面向零基础用户的浏览器端 DAW，帮助新手 5 分钟内做出自己的小 demo。

---

## 核心原则

1. **新手优先** — 每个功能的判断标准：新手能不能 5 分钟内理解并上手？
2. **能出声就能玩** — 降低从打开到听到第一声音的摩擦
3. **渐进式复杂度** — 基础操作极简，高级功能按需发现
4. **即时反馈** — 操作立刻听到结果，所见即所得

---

## ✅ 已完成功能（P0-P2 全部完成）

### 基础 DAW 能力
| 功能 | 实现位置 |
|------|---------|
| 多轨时间轴（16 beats） | `Timeline.tsx` |
| Clip 创建/删除/复制/拆分 | `useDAWActions.ts` |
| 播放/暂停/停止 | `Transport.tsx` |
| BPM 设置 + Tap Tempo | `Transport.tsx` |
| 播放头拖拽 + Beat 吸附 | `Timeline.tsx` |
| Undo/Redo、复制/粘贴 | `useDAWActions.ts` |
| 循环播放 + 节拍器 | `AudioEngine.ts` |
| 主控音量 + 电平表 | `Mixer.tsx` |
| 轨道音量/静音/Solo/锁定 | `TrackList.tsx` |
| 项目重置 | `useDAWStore.ts` |

### 音频合成 & 效果器
| 功能 | 实现位置 |
|------|---------|
| 9 种波形/音色（sine/square/saw/triangle/organ/brass + Pad/Lead） | `AudioEngine.ts` |
| Clip 音高 + 移调 | `Inspector.tsx` |
| Clip 音量 + 淡入淡出 | `Inspector.tsx` |
| 7 种效果器（Reverb/Delay/Distortion/Compressor/Filter/Chorus/Flanger） | `Inspector.tsx` |
| 3 段主控 EQ | `Mixer.tsx` |
| WAV 音频导出 | `audioBufferToWav.ts` |
| 麦克风录音 | `AudioEngine.ts` |
| MIDI 导入/导出 | `useDAWActions.ts` |

### 新手体验
| 功能 | 实现位置 |
|------|---------|
| 预设 demo 模板（鼓点/旋律） | `demos.ts` + `Transport.tsx` |
| 新手引导（交互式） | `Onboarding.tsx` |
| 键盘快捷键（Space/Ctrl+Z 等） | `useDAWActions.ts` |
| 点击 clip 即刻预览 | `useDAWActions.ts` |
| 音符选择器（C3/D4 等） | `Inspector.tsx` + `notes.ts` |
| 音色名称替代波形名 | `cycleClipWave` |
| 音量百分比滑块 | `Inspector.tsx` |
| 播放时高亮当前 beat/clip | `Timeline.tsx` |
| 高级功能默认折叠 | `Inspector.tsx` |
| 深色主题（VoltAgent 设计） | 全局 |

---

## 🔲 下一阶段：产品打磨（P3）

> P0-P2 功能已全部就绪，代码约 4400 行、78 个 e2e 测试。接下来围绕**"新手能真正做出完整 demo 并分享"**这个终极目标打磨体验。

### P3-A — 分享 & 完整性（达成"做出 demo 并分享"闭环）
- [ ] **项目保存/加载** — localStorage 持久化，关闭浏览器不丢进度
- [x] **分享链接** — 将项目编码到 URL hash 或生成短链接，发给朋友能直接打开听到
- [ ] **MP3 导出** — 除 WAV 外支持 MP3 格式，方便社交分享

### P3-B — 新手引导深化
- [x] **引导完成后的"下一步提示"** — 新手完成引导后，引导他加载第一个 demo 模板试试
- [x] **空白项目时的引导气泡** — 新建项目后如果 10 秒没操作，弹出轻量提示
- [x] **快捷键面板** — 界面上有 `?` 按钮，点击显示所有快捷键一览

### P3-C — 音频体验提升
- [x] **更丰富的 demo 模板** — 至少 4-5 个不同风格的预设（电子/嘻哈/氛围/古典/Lo-Fi）
- [ ] **音色预览** — 在音色选择器悬停时播放该音色的示范音
- [ ] **录音后自动创建 Clip** — 录音结束后自动将录音片段放到当前轨道的时间轴上（目前录音功能缺少与时间轴的整合）

### P3-D — 视觉 & 交互优化
- [ ] **SVG 波形显示** — Clip 内显示波形图形而非纯色块
- [ ] **轨道颜色系统** — 每条轨道可设置颜色，Clip 背景用 track.color 30% 半透明
- [ ] **拖拽反馈优化** — 拖拽 clip 时显示吸附位置预览
- [ ] **响应式布局** — 支持常见笔记本屏幕尺寸（1366px+）

---

## 不做（明确排除）

- ❌ 专业级功能（自动化曲线、高级 MIDI 编辑、多声道输出）
- ❌ 插件系统（VST/AU）
- ❌ 移动端适配（专注桌面浏览器）
- ❌ 协作/云存储
- ❌ 采样器/音频文件导入（当前仅合成器 + 录音）

---

## Harness 质量指标（2026-04-08）

- 总评测次数：147
- 通过率：85.71%
- 最新评分：124/150
- 代码行数：~4400 行
- e2e 测试：78 个
