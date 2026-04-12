import type { WaveType } from '../types'
import type { DAWActions } from '../hooks/useDAWActions'
import { SELECTABLE_NOTES, hzToClosestNoteLabel } from '../utils/notes'
import { useState } from 'react'
import { isNoteInScale, type ScaleType } from '../utils/scales'

export function Inspector(d: DAWActions) {
  const {
    selectedTrackId, selectedClipData, isPlaying, project,
    renameTrack, setTrackColor, setTrackPan, setTrackTranspose,
    setProject, applyProjectUpdate, setTrackFilterType, setTrackFilterCutoff,
    duplicateTrack, moveTrack, deleteTrack,
    setClipName, setClipColor, setSelectedClipWave, updateClipGain,
    updateClipEnvelopePoint, resetClipEnvelope,
    updateClipTranspose, setSelectedClipNote, updateClipLengthBeats, alignAudioClipToProjectBpm, alignVocalClipTiming, resetVocalClipTimingAlign, applyVocalPitchAssist, setVocalPitchDryWet, toggleVocalPitchAssist, quantizeClip, insertChordPreset, generateMelody, normalizeClipGains, applyMagicPolish, applyMoodPreset, generateStyleStarter, generateSongArrangement, continueTrackIdea,
    updateClipFades, toggleClipMute, deleteClip, copyClip, pasteClip,
    duplicateClip, splitClip, clipboard, previewClip,
    autoMixSuggestionItems, autoMixAvailable, autoMixPreviewMode, autoMixCoverageReady,
    runAutoMixAssistant, toggleAutoMixSuggestion, previewAutoMixVersion,
    projectHealthReport, resolveProjectHealthRisk,
    chorusLiftMarkerOptions, selectedChorusLiftMarkerId, chorusLiftSettings, chorusDoubleHarmonySettings,
    setSelectedChorusLiftMarkerId, toggleChorusLiftSetting, toggleChorusDoubleHarmonySetting, applyChorusLiftBuilder, applyChorusDoubleHarmonyBuilder,
    sectionEnergyOptions, selectedSectionEnergyIds, toggleSectionEnergySelection, applySectionEnergyAutomation, resetSectionEnergyAutomation,
    enableVocalCleanChain, setVocalFinalizerEnabled, setVocalFinalizerPreset, setVocalFinalizerMix,
    favoriteClips, favoriteClipSearchQuery, setFavoriteClipSearchQuery,
    saveFavoriteClipFromSelection, pasteFavoriteClipToTrack, deleteFavoriteClip,
    selectedClipRef, selectedClipRefs, chordSuggestions,
  } = d

  const scaleKey = project.scaleKey || 'C'
  const scaleType = (project.scaleType || 'chromatic') as ScaleType
  const scaleKeyIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(scaleKey)

  const availableNotes = SELECTABLE_NOTES.filter(n => {
    if (scaleType === 'chromatic') return true
    const noteIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(n.label.replace(/-?\d+$/, ''))
    if (noteIndex === -1) return true
    return isNoteInScale(noteIndex, scaleKeyIndex, scaleType)
  })

  const [continueLockRhythm, setContinueLockRhythm] = useState(false)
  const [continueLockPitch, setContinueLockPitch] = useState(false)

  const allSelectedClipRefs = [...(selectedClipRefs || [])]
  if (selectedClipRef && !allSelectedClipRefs.some(r => r.clipId === selectedClipRef.clipId)) {
    allSelectedClipRefs.unshift(selectedClipRef)
  }

  const autoMixAppliedCount = autoMixSuggestionItems.filter((item) => item.applied).length
  const autoMixCoverageLabel = `${autoMixSuggestionItems.some((item) => item.applied && item.category === 'drum') ? '鼓组✓' : '鼓组—'} / ${autoMixSuggestionItems.some((item) => item.applied && item.category === 'bass') ? '贝斯✓' : '贝斯—'} / ${autoMixSuggestionItems.some((item) => item.applied && item.category === 'harmony') ? '和声✓' : '和声—'}`

  return (
    <section className="inspector w-80 bg-[#111] border-l border-gray-800 flex flex-col overflow-y-auto flex-shrink-0" data-testid="inspector-panel">
      <div className="h-8 border-b border-gray-800 flex items-center px-4 bg-[#0a0a0a] sticky top-0 z-10">
        <span className="text-xs text-gray-500 font-medium">INSPECTOR</span>
      </div>

      <div className="p-4 space-y-4">
        {selectedTrackId ? (
          <details className="inspector-group sm" data-testid="inspector-track" open>
            <summary className="inspector-subtitle">Track Settings</summary>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input
                  data-testid="selected-track-name-input"
                  type="text"
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.name ?? ''}
                  onChange={(e) => renameTrack(selectedTrackId, e.target.value)}
                  disabled={isPlaying}
                  className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1">Color</label>
                <input
                  data-testid="selected-track-color-input"
                  type="color"
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.color || '#4a5568'}
                  onChange={(e) => setTrackColor(selectedTrackId, e.target.value)}
                  disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked}
                  className="w-full h-8 bg-[#1a1a1a] border border-gray-800 rounded cursor-pointer"
                />
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-chord-progression">
                <label className="text-xs text-gray-500 block">Quick Chord Progression</label>
                <div className="grid grid-cols-1 gap-1">
                  <button
                    type="button"
                    data-testid="insert-chord-I-V-vi-IV"
                    onClick={() => insertChordPreset(selectedTrackId, 'I-V-vi-IV')}
                    disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    Insert I–V–vi–IV
                  </button>
                  <button
                    type="button"
                    data-testid="insert-chord-vi-IV-I-V"
                    onClick={() => insertChordPreset(selectedTrackId, 'vi-IV-I-V')}
                    disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    Insert vi–IV–I–V
                  </button>
                  <button
                    type="button"
                    data-testid="insert-chord-I-vi-IV-V"
                    onClick={() => insertChordPreset(selectedTrackId, 'I-vi-IV-V')}
                    disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    Insert I–vi–IV–V
                  </button>
                </div>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-style-starter">
                <label className="text-xs text-gray-500 block">Style Starter (8-bar draft)</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="style-starter-lofi-btn"
                    onClick={() => generateStyleStarter('lofi')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    Lo-Fi
                  </button>
                  <button
                    type="button"
                    data-testid="style-starter-edm-btn"
                    onClick={() => generateStyleStarter('edm')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    EDM
                  </button>
                  <button
                    type="button"
                    data-testid="style-starter-hiphop-btn"
                    onClick={() => generateStyleStarter('hiphop')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    HipHop
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">One click generates drum + chord + bass draft and sets BPM/scale.</p>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-arrangement-assistant">
                <label className="text-xs text-gray-500 block">Song Arrangement Assistant</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    data-testid="arrangement-8-bars-btn"
                    onClick={() => generateSongArrangement(8)}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    8 Bars
                  </button>
                  <button
                    type="button"
                    data-testid="arrangement-16-bars-btn"
                    onClick={() => generateSongArrangement(16)}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    16 Bars
                  </button>
                  <button
                    type="button"
                    data-testid="arrangement-32-bars-btn"
                    onClick={() => generateSongArrangement(32)}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    32 Bars
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">按 Intro/Verse/Chorus/Drop 自动编排并覆盖段落标记；支持 Undo 一键撤销。</p>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-section-energy-automation">
                <label className="text-xs text-gray-500 block">Section Energy Automation (Marker-driven)</label>
                {sectionEnergyOptions.length === 0 ? (
                  <p className="text-[10px] text-gray-500" data-testid="section-energy-empty">暂无段落标记（请先在时间线添加 Intro/Verse/Chorus/Drop 标记）</p>
                ) : (
                  <>
                    <div className="space-y-1" data-testid="section-energy-selection-list">
                      {sectionEnergyOptions.map((section) => (
                        <label
                          key={section.id}
                          className="inline-flex w-full items-start gap-2 rounded border border-gray-700 bg-[#111] px-2 py-1 text-[10px] text-gray-300"
                          data-testid={`section-energy-option-${section.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSectionEnergyIds.includes(section.id)}
                            onChange={() => toggleSectionEnergySelection(section.id)}
                            disabled={isPlaying}
                            className="mt-0.5 accent-emerald-500"
                            data-testid={`section-energy-toggle-${section.id}`}
                          />
                          <span>
                            <strong>{section.name}</strong> · {Math.round(section.startBeat / 4) + 1}-{Math.round(section.endBeat / 4) + 1} 小节
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        data-testid="section-energy-apply-btn"
                        onClick={() => applySectionEnergyAutomation()}
                        disabled={isPlaying || selectedSectionEnergyIds.length === 0}
                        className="text-xs px-2 py-1 rounded bg-[#0f766e] hover:bg-[#115e59] text-white disabled:opacity-40"
                      >
                        应用能量曲线
                      </button>
                      <button
                        type="button"
                        data-testid="section-energy-reset-btn"
                        onClick={() => resetSectionEnergyAutomation()}
                        disabled={isPlaying}
                        className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                      >
                        恢复应用前
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500">基于段落类型自动联动 clip gain、master 趋势与鼓/贝斯/和声轨道能量（reverb + filter）。</p>
                  </>
                )}
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-chorus-lift-builder">
                <label className="text-xs text-gray-500 block">Chorus Lift Builder</label>
                {chorusLiftMarkerOptions.length === 0 ? (
                  <p className="text-[10px] text-gray-500" data-testid="chorus-lift-empty">暂无副歌标记（请先添加/生成名为 Chorus 或 副歌 的标记）</p>
                ) : (
                  <>
                    <label className="text-[10px] text-gray-500 block">目标副歌段落</label>
                    <select
                      data-testid="chorus-lift-marker-select"
                      value={selectedChorusLiftMarkerId ?? ''}
                      onChange={(e) => setSelectedChorusLiftMarkerId(e.target.value || null)}
                      disabled={isPlaying}
                      className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs text-gray-200"
                    >
                      {chorusLiftMarkerOptions.map((marker) => (
                        <option key={marker.id} value={marker.id}>
                          {marker.name} · {Math.round(marker.startBeat / 4) + 1}-{Math.round(marker.endBeat / 4) + 1} 小节
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-1 gap-1 text-[10px] text-gray-300">
                      <label className="inline-flex items-center gap-2" data-testid="chorus-lift-toggle-drumDensity-label">
                        <input
                          type="checkbox"
                          data-testid="chorus-lift-toggle-drumDensity"
                          checked={chorusLiftSettings.drumDensity}
                          onChange={() => toggleChorusLiftSetting('drumDensity')}
                          disabled={isPlaying}
                          className="accent-emerald-500"
                        />
                        鼓层加密（副歌区间增加半拍层）
                      </label>
                      <label className="inline-flex items-center gap-2" data-testid="chorus-lift-toggle-harmonyThicken-label">
                        <input
                          type="checkbox"
                          data-testid="chorus-lift-toggle-harmonyThicken"
                          checked={chorusLiftSettings.harmonyThicken}
                          onChange={() => toggleChorusLiftSetting('harmonyThicken')}
                          disabled={isPlaying}
                          className="accent-emerald-500"
                        />
                        和声加厚（+7 半音叠层）
                      </label>
                      <label className="inline-flex items-center gap-2" data-testid="chorus-lift-toggle-gainLift-label">
                        <input
                          type="checkbox"
                          data-testid="chorus-lift-toggle-gainLift"
                          checked={chorusLiftSettings.gainLift}
                          onChange={() => toggleChorusLiftSetting('gainLift')}
                          disabled={isPlaying}
                          className="accent-emerald-500"
                        />
                        自动增益上扬（约 +1.5 dB）
                      </label>
                    </div>
                    <button
                      type="button"
                      data-testid="chorus-lift-apply-btn"
                      onClick={() => applyChorusLiftBuilder()}
                      disabled={isPlaying || !selectedChorusLiftMarkerId || (!chorusLiftSettings.drumDensity && !chorusLiftSettings.harmonyThicken && !chorusLiftSettings.gainLift)}
                      className="w-full text-xs px-2 py-1 rounded bg-[#0f766e] hover:bg-[#115e59] text-white disabled:opacity-40"
                    >
                      应用副歌增强
                    </button>
                    <p className="text-[10px] text-gray-500">仅处理所选副歌标记区段；支持逐项开关与 Undo 回退。</p>
                  </>
                )}
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-chorus-double-harmony-builder">
                <label className="text-xs text-gray-500 block">Chorus Double & Harmony Builder</label>
                {chorusLiftMarkerOptions.length === 0 ? (
                  <p className="text-[10px] text-gray-500" data-testid="chorus-double-harmony-empty">暂无副歌标记（请先添加/生成名为 Chorus 或 副歌 的标记）</p>
                ) : !selectedTrackId ? (
                  <p className="text-[10px] text-gray-500" data-testid="chorus-double-harmony-no-track">请先选择一条主唱轨道</p>
                ) : (
                  <>
                    <p className="text-[10px] text-gray-500" data-testid="chorus-double-harmony-source-track">
                      源轨道：{project.tracks.find((t) => t.id === selectedTrackId)?.name || '未选择'}
                    </p>
                    <label className="inline-flex items-center gap-2 text-[10px] text-gray-300" data-testid="chorus-double-harmony-toggle-high-octave-label">
                      <input
                        type="checkbox"
                        data-testid="chorus-double-harmony-toggle-high-octave"
                        checked={chorusDoubleHarmonySettings.highOctaveHarmony}
                        onChange={() => toggleChorusDoubleHarmonySetting('highOctaveHarmony')}
                        disabled={isPlaying}
                        className="accent-emerald-500"
                      />
                      Harmony 提高八度（+12 半音）
                    </label>
                    <button
                      type="button"
                      data-testid="chorus-double-harmony-apply-btn"
                      onClick={() => applyChorusDoubleHarmonyBuilder()}
                      disabled={isPlaying || chorusLiftMarkerOptions.length === 0}
                      className="w-full text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-40"
                    >
                      生成 Double + Harmony 轨
                    </button>
                    <p className="text-[10px] text-gray-500">在所选副歌区间复制主唱并自动生成为两条新轨道，便于快速堆叠。</p>
                  </>
                )}
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-mood-presets">
                <label className="text-xs text-gray-500 block">Mood Presets</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    data-testid="mood-preset-happy-btn"
                    onClick={() => applyMoodPreset('happy')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    开心
                  </button>
                  <button
                    type="button"
                    data-testid="mood-preset-healing-btn"
                    onClick={() => applyMoodPreset('healing')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    治愈
                  </button>
                  <button
                    type="button"
                    data-testid="mood-preset-tense-btn"
                    onClick={() => applyMoodPreset('tense')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    紧张
                  </button>
                  <button
                    type="button"
                    data-testid="mood-preset-cyber-btn"
                    onClick={() => applyMoodPreset('cyber')}
                    disabled={isPlaying}
                    className="text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                  >
                    赛博
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">一键应用 BPM/调式/音色组合，并生成对应风格草稿。</p>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-melody-generator">
                <label className="text-xs text-gray-500 block">Melody Generator</label>
                <button
                  type="button"
                  data-testid="generate-melody-btn"
                  onClick={() => generateMelody(selectedTrackId, { noteCount: 8, stepBeats: 0.5 })}
                  disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                  className="w-full text-xs px-2 py-1 rounded bg-[#0f766e] hover:bg-[#115e59] text-white disabled:opacity-40"
                >
                  Generate scale-locked melody (8 notes)
                </button>
                <div className="rounded border border-gray-700 bg-[#101010] p-2 space-y-2" data-testid="continue-mvp-panel">
                  <label className="text-[10px] text-gray-500 block">Continue MVP (next-bar ideas)</label>
                  <div className="flex items-center gap-3 text-[10px] text-gray-400">
                    <label className="inline-flex items-center gap-1" data-testid="continue-lock-rhythm-label">
                      <input
                        type="checkbox"
                        data-testid="continue-lock-rhythm"
                        checked={continueLockRhythm}
                        onChange={(e) => setContinueLockRhythm(e.target.checked)}
                        disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                        className="accent-emerald-500"
                      />
                      Lock Rhythm
                    </label>
                    <label className="inline-flex items-center gap-1" data-testid="continue-lock-pitch-label">
                      <input
                        type="checkbox"
                        data-testid="continue-lock-pitch"
                        checked={continueLockPitch}
                        onChange={(e) => setContinueLockPitch(e.target.checked)}
                        disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                        className="accent-emerald-500"
                      />
                      Lock Pitch
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      data-testid="continue-conservative-btn"
                      onClick={() => continueTrackIdea(selectedTrackId, 'conservative', { lockRhythm: continueLockRhythm, lockPitch: continueLockPitch })}
                      disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                      className="text-[10px] px-1 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                    >
                      Conservative
                    </button>
                    <button
                      type="button"
                      data-testid="continue-balanced-btn"
                      onClick={() => continueTrackIdea(selectedTrackId, 'balanced', { lockRhythm: continueLockRhythm, lockPitch: continueLockPitch })}
                      disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                      className="text-[10px] px-1 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                    >
                      Balanced
                    </button>
                    <button
                      type="button"
                      data-testid="continue-bold-btn"
                      onClick={() => continueTrackIdea(selectedTrackId, 'bold', { lockRhythm: continueLockRhythm, lockPitch: continueLockPitch })}
                      disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                      className="text-[10px] px-1 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                    >
                      Bold
                    </button>
                  </div>
                  <button
                    type="button"
                    data-testid="continue-reroll-btn"
                    onClick={() => continueTrackIdea(selectedTrackId, 'balanced', { lockRhythm: continueLockRhythm, lockPitch: continueLockPitch })}
                    disabled={isPlaying || project.tracks.find((t) => t.id === selectedTrackId)?.locked || project.tracks.find((t) => t.id === selectedTrackId)?.isDrumTrack}
                    className="w-full text-[10px] px-1 py-1 rounded bg-[#0f766e] hover:bg-[#115e59] text-white disabled:opacity-40"
                  >
                    再来一版（Balanced）
                  </button>
                </div>
                <button
                  type="button"
                  data-testid="normalize-all-clips-btn"
                  onClick={normalizeClipGains}
                  disabled={isPlaying}
                  className="w-full text-xs px-2 py-1 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 disabled:opacity-40"
                >
                  Normalize clip volumes
                </button>
                <button
                  type="button"
                  data-testid="magic-polish-btn"
                  onClick={applyMagicPolish}
                  disabled={isPlaying}
                  className="w-full text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-40"
                >
                  Magic Polish (Beginner Mix)
                </button>
                <p className="text-[10px] text-gray-500">Uses current Scale Key / Scale Type to create inspiration clips.</p>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="project-health-panel">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500 block">Project Health Panel</label>
                  <span className={`text-[10px] ${projectHealthReport.failedCount === 0 ? 'text-emerald-400' : 'text-amber-300'}`} data-testid="project-health-failed-count">
                    {projectHealthReport.failedCount === 0 ? '风险 0' : `${projectHealthReport.failedCount} 项风险`}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500" data-testid="project-health-checked-at">
                  最近检查：{new Date(projectHealthReport.checkedAt).toLocaleTimeString()}
                </p>
                <div className="space-y-1" data-testid="project-health-risk-list">
                  {projectHealthReport.items.map((item) => (
                    <div
                      key={item.key}
                      className={`rounded border px-2 py-1 ${item.passed ? 'border-emerald-900/60 bg-emerald-950/20 text-emerald-200' : 'border-amber-800/70 bg-amber-950/30 text-amber-100'}`}
                      data-testid={`project-health-risk-${item.key}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium">{item.passed ? '✅' : '⚠️'} {item.label}</span>
                        <button
                          type="button"
                          data-testid={`project-health-fix-${item.key}`}
                          onClick={() => resolveProjectHealthRisk(item.key)}
                          disabled={item.passed || isPlaying}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-100 disabled:opacity-40"
                        >
                          {item.actionLabel}
                        </button>
                      </div>
                      <p className="text-[10px] opacity-80">{item.detail}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500">风险项与导出清单保持一致，可一键跳转并修复。</p>
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="auto-mix-assistant-panel">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500 block">Auto Mix Assistant</label>
                  {autoMixAvailable && (
                    <span className={`text-[10px] ${autoMixCoverageReady ? 'text-emerald-400' : 'text-amber-300'}`} data-testid="auto-mix-coverage-status">
                      {autoMixCoverageReady ? '覆盖鼓/贝斯/和声 ✓' : '覆盖不足'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  data-testid="run-auto-mix-btn"
                  onClick={runAutoMixAssistant}
                  disabled={isPlaying || project.tracks.length === 0}
                  className="w-full text-xs px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white disabled:opacity-40"
                >
                  一键自动混音（音量/声像/低频避让）
                </button>

                {autoMixAvailable ? (
                  <>
                    <div className="grid grid-cols-2 gap-1" data-testid="auto-mix-ab-toggle">
                      <button
                        type="button"
                        data-testid="auto-mix-preview-before-btn"
                        onClick={() => previewAutoMixVersion('before')}
                        disabled={isPlaying}
                        className={`text-[10px] px-2 py-1 rounded border ${autoMixPreviewMode === 'before' ? 'bg-amber-900/40 border-amber-700 text-amber-200' : 'bg-[#1f2937] border-gray-700 text-gray-200 hover:bg-[#374151]'}`}
                      >
                        A：应用前
                      </button>
                      <button
                        type="button"
                        data-testid="auto-mix-preview-after-btn"
                        onClick={() => previewAutoMixVersion('after')}
                        disabled={isPlaying}
                        className={`text-[10px] px-2 py-1 rounded border ${autoMixPreviewMode === 'after' ? 'bg-emerald-900/40 border-emerald-700 text-emerald-200' : 'bg-[#1f2937] border-gray-700 text-gray-200 hover:bg-[#374151]'}`}
                      >
                        B：应用后
                      </button>
                    </div>

                    <p className="text-[10px] text-gray-500" data-testid="auto-mix-summary">
                      {autoMixAppliedCount}/{autoMixSuggestionItems.length} 条建议已应用 · {autoMixCoverageLabel}
                    </p>

                    <div className="space-y-1" data-testid="auto-mix-suggestion-list">
                      {autoMixSuggestionItems.map((suggestion) => (
                        <label
                          key={suggestion.id}
                          className="flex items-start gap-2 rounded border border-gray-700 bg-[#111] p-2 text-[10px] text-gray-300"
                          data-testid={`auto-mix-suggestion-${suggestion.id}`}
                        >
                          <input
                            type="checkbox"
                            checked={suggestion.applied}
                            onChange={() => toggleAutoMixSuggestion(suggestion.id)}
                            disabled={isPlaying}
                            className="mt-0.5 accent-emerald-500"
                            data-testid={`auto-mix-toggle-${suggestion.id}`}
                          />
                          <span>
                            <strong>{suggestion.trackName}</strong> · {suggestion.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-gray-500">点击按钮后将生成鼓/贝斯/和声三类建议，并支持单条撤销。</p>
                )}
              </div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="inspector-chord-suggestions">
                <label className="text-xs text-gray-500 block">Chord Suggestions</label>
                {chordSuggestions.length > 0 ? (
                  <ul className="space-y-1">
                    {chordSuggestions.map((item, index) => (
                      <li key={`${item.name}-${index}`} className="flex items-center justify-between text-xs text-gray-300">
                        <span>{item.name}</span>
                        <span className="text-gray-500">{Math.round(item.confidence * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-gray-500">Add a few clips first, then suggestions will appear.</p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Pan</span>
                  <span>{(() => { const p = project.tracks.find(t => t.id === selectedTrackId)?.pan ?? 0; return p === 0 ? 'C' : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`; })()}</span>
                </label>
                <input
                  data-testid={`pan-${selectedTrackId}`}
                  type="range"
                  min={-1}
                  max={1}
                  step={0.01}
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.pan ?? 0}
                  onChange={(e) => setTrackPan(selectedTrackId, Number(e.target.value))}
                  disabled={isPlaying}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 flex justify-between mb-1">
                  <span>Transpose (semitones)</span>
                  <span>{(() => { const t = project.tracks.find(t => t.id === selectedTrackId)?.transposeSemitones ?? 0; return t > 0 ? '+' + t : '' + t; })()}</span>
                </label>
                <input
                  data-testid={`transpose-${selectedTrackId}`}
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={project.tracks.find((t) => t.id === selectedTrackId)?.transposeSemitones ?? 0}
                  onChange={(e) => setTrackTranspose(selectedTrackId, Number(e.target.value))}
                  disabled={isPlaying}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Effects Section */}
              <details className="inspector-group sm" data-testid="inspector-track-effects" open>
                <summary className="inspector-subtitle">Track Effects & Params</summary>
                <div className="track-effects-details space-y-3">
                  {(() => {
                    const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
                    if (!selectedTrack) return null;
                    return (
                      <div className="space-y-3">
                        {/* Vocal Clean Chain */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input
                              type="checkbox"
                              data-testid={`vocal-clean-enabled-${selectedTrack.id}`}
                              checked={!!selectedTrack.vocalCleanEnabled}
                              disabled={isPlaying}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  enableVocalCleanChain(selectedTrack.id)
                                  return
                                }
                                applyProjectUpdate(prev => ({
                                  ...prev,
                                  tracks: prev.tracks.map(t => t.id === selectedTrack.id
                                    ? { ...t, vocalCleanEnabled: false, vocalInputWarning: null, vocalInputAdvice: '' }
                                    : t),
                                }))
                              }}
                              className="accent-emerald-500"
                            />
                            Vocal Clean Chain
                          </summary>
                          <div className="p-3 pt-0">
                            {selectedTrack.vocalCleanEnabled && (
                              <div className="space-y-2 pl-6 mt-2" data-testid={`vocal-clean-chain-${selectedTrack.id}`}>
                                <p className="text-[10px] text-gray-500">包含：去底噪（高通）/ 齿音抑制 / 基础压缩 / 响度补偿（导出生效）</p>
                                <div>
                                  <label className="text-[10px] text-gray-500 flex justify-between"><span>Denoise</span><span>{Math.round((selectedTrack.vocalDenoiseAmount ?? 0.45) * 100)}%</span></label>
                                  <input type="range" min="0" max="1" step="0.05" data-testid={`vocal-denoise-${selectedTrack.id}`} value={selectedTrack.vocalDenoiseAmount ?? 0.45} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, vocalDenoiseAmount: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 flex justify-between"><span>De-ess</span><span>{Math.round((selectedTrack.vocalDeEssAmount ?? 0.5) * 100)}%</span></label>
                                  <input type="range" min="0" max="1" step="0.05" data-testid={`vocal-deess-${selectedTrack.id}`} value={selectedTrack.vocalDeEssAmount ?? 0.5} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, vocalDeEssAmount: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 flex justify-between"><span>Comp</span><span>{Math.round((selectedTrack.vocalCompAmount ?? 0.55) * 100)}%</span></label>
                                  <input type="range" min="0" max="1" step="0.05" data-testid={`vocal-comp-${selectedTrack.id}`} value={selectedTrack.vocalCompAmount ?? 0.55} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, vocalCompAmount: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 flex justify-between"><span>Make-up</span><span>{(selectedTrack.vocalMakeupGainDb ?? 2).toFixed(1)}dB</span></label>
                                  <input type="range" min="-3" max="8" step="0.5" data-testid={`vocal-makeup-${selectedTrack.id}`} value={selectedTrack.vocalMakeupGainDb ?? 2} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, vocalMakeupGainDb: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" />
                                </div>
                                {selectedTrack.vocalInputWarning && (
                                  <div data-testid={`vocal-input-warning-${selectedTrack.id}`} className={`rounded border px-2 py-1 text-[10px] ${selectedTrack.vocalInputWarning === 'clipping' ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-amber-700 bg-amber-950/30 text-amber-200'}`}>
                                    <strong>{selectedTrack.vocalInputWarning === 'clipping' ? '输入告警：可能削波' : '输入告警：电平偏低'}</strong>
                                    <div>{selectedTrack.vocalInputAdvice || '建议调整录音输入后再导出。'}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </details>

                        {/* Vocal Finalizer */}
                        <div className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <div className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3">
                            <input
                              type="checkbox"
                              data-testid={`vocal-finalizer-enabled-${selectedTrack.id}`}
                              checked={!!selectedTrack.vocalFinalizerEnabled}
                              disabled={isPlaying}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setVocalFinalizerEnabled(selectedTrack.id, e.target.checked)}
                              className="accent-emerald-500"
                            />
                            Vocal Finalizer
                          </div>
                          <div className="p-3 pt-0">
                            {selectedTrack.vocalFinalizerEnabled && (
                              <div className="space-y-2 pl-6 mt-2" data-testid={`vocal-finalizer-chain-${selectedTrack.id}`}>
                                <p className="text-[10px] text-gray-500">三档成品链：清晰 / 暖声 / 贴耳，实时 A/B + 导出生效</p>
                                <div>
                                  <label className="text-[10px] text-gray-500 block mb-1">Preset</label>
                                  <div className="grid grid-cols-3 gap-1">
                                    <button type="button" data-testid={`vocal-finalizer-preset-clear-${selectedTrack.id}`} onClick={() => setVocalFinalizerPreset(selectedTrack.id, 'clear')} disabled={isPlaying} className={`text-[10px] px-2 py-1 rounded border ${selectedTrack.vocalFinalizerPreset === 'clear' || !selectedTrack.vocalFinalizerPreset ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20' : 'border-gray-700 text-gray-300 hover:bg-gray-800/50'}`}>清晰</button>
                                    <button type="button" data-testid={`vocal-finalizer-preset-warm-${selectedTrack.id}`} onClick={() => setVocalFinalizerPreset(selectedTrack.id, 'warm')} disabled={isPlaying} className={`text-[10px] px-2 py-1 rounded border ${selectedTrack.vocalFinalizerPreset === 'warm' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20' : 'border-gray-700 text-gray-300 hover:bg-gray-800/50'}`}>暖声</button>
                                    <button type="button" data-testid={`vocal-finalizer-preset-intimate-${selectedTrack.id}`} onClick={() => setVocalFinalizerPreset(selectedTrack.id, 'intimate')} disabled={isPlaying} className={`text-[10px] px-2 py-1 rounded border ${selectedTrack.vocalFinalizerPreset === 'intimate' ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20' : 'border-gray-700 text-gray-300 hover:bg-gray-800/50'}`}>贴耳</button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 flex justify-between"><span>强度</span><span>{Math.round((selectedTrack.vocalFinalizerMix ?? 0.7) * 100)}%</span></label>
                                  <input type="range" min="0" max="1" step="0.01" data-testid={`vocal-finalizer-mix-${selectedTrack.id}`} value={selectedTrack.vocalFinalizerMix ?? 0.7} disabled={isPlaying} onChange={(e) => setVocalFinalizerMix(selectedTrack.id, Number(e.target.value))} className="w-full h-1 accent-emerald-500" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Reverb */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`reverb-enable-${selectedTrack.id}`} checked={!!selectedTrack.reverbEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Reverb
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.reverbEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Mix</span><span>{Math.round((selectedTrack.reverbMix ?? 0.3) * 100)}%</span></label><input type="range" min="0" max="1" step="0.05" data-testid={`reverb-mix-${selectedTrack.id}`} value={selectedTrack.reverbMix ?? 0.3} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbMix: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Decay</span><span>{selectedTrack.reverbDecay ?? 2}s</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`reverb-decay-${selectedTrack.id}`} value={selectedTrack.reverbDecay ?? 2} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, reverbDecay: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Delay */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`delay-enable-${selectedTrack.id}`} checked={!!selectedTrack.delayEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Delay
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.delayEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Time</span><span>{(selectedTrack.delayTime ?? 0.3).toFixed(2)}s</span></label><input type="range" min="0.1" max="2" step="0.1" data-testid={`delay-time-${selectedTrack.id}`} value={selectedTrack.delayTime ?? 0.3} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayTime: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Feedback</span><span>{Math.round((selectedTrack.delayFeedback ?? 0.4) * 100)}%</span></label><input type="range" min="0" max="0.9" step="0.1" data-testid={`delay-fb-${selectedTrack.id}`} value={selectedTrack.delayFeedback ?? 0.4} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, delayFeedback: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Filter */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium text-gray-300 block mb-2 p-3 cursor-pointer">Filter</summary>
                          <div className="p-3 pt-0">
                          <select data-testid={`filter-type-${selectedTrack.id}`} value={selectedTrack.filterType} onChange={(e) => setTrackFilterType(selectedTrack.id, e.target.value as 'none' | 'lowpass' | 'highpass')} disabled={isPlaying} className="w-full bg-[#111] border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 mb-2 text-gray-300">
                            <option value="none">None</option><option value="lowpass">Lowpass</option><option value="highpass">Highpass</option>
                          </select>
                          {selectedTrack.filterType !== 'none' && (
                            <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Cutoff</span><span>{selectedTrack.filterCutoff}Hz</span></label><input type="range" min="20" max="20000" step="10" data-testid={`filter-cutoff-${selectedTrack.id}`} value={selectedTrack.filterCutoff} onChange={(e) => setTrackFilterCutoff(selectedTrack.id, Number(e.target.value))} disabled={isPlaying} className="w-full h-1 accent-emerald-500" /></div>
                          )}
                          </div>
                        </details>

                        {/* Distortion */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`track-distortion-toggle-${selectedTrack.id}`} checked={!!selectedTrack.distortionEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, distortionEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Distortion
                          </summary>
                        </details>

                        {/* Compressor */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`compressor-enabled-${selectedTrack.id}`} checked={!!selectedTrack.compressorEnabled} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Comp
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.compressorEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Threshold</span><span>{selectedTrack.compressorThreshold ?? -24}dB</span></label><input type="range" min="-100" max="0" step="1" data-testid={`compressor-threshold-${selectedTrack.id}`} value={selectedTrack.compressorThreshold ?? -24} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorThreshold: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Ratio</span><span>{selectedTrack.compressorRatio ?? 12}:1</span></label><input type="range" min="1" max="20" step="0.1" data-testid={`compressor-ratio-${selectedTrack.id}`} value={selectedTrack.compressorRatio ?? 12} disabled={isPlaying} onChange={(e) => applyProjectUpdate(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, compressorRatio: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Chorus */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`chorus-enabled-${selectedTrack.id}`} checked={!!selectedTrack.chorusEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Chorus
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.chorusEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Rate</span><span>{selectedTrack.chorusRate ?? 1.5}</span></label><input type="range" min="0.1" max="10" step="0.1" data-testid={`chorus-rate-${selectedTrack.id}`} value={selectedTrack.chorusRate ?? 1.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusRate: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.chorusDepth ?? 0.5}</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`chorus-depth-${selectedTrack.id}`} value={selectedTrack.chorusDepth ?? 0.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, chorusDepth: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Tremolo */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`tremolo-enabled-${selectedTrack.id}`} checked={!!selectedTrack.tremoloEnabled} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Tremolo
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.tremoloEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Rate</span><span>{selectedTrack.tremoloRate ?? 5.0}</span></label><input type="range" min="0.1" max="20" step="0.1" data-testid={`tremolo-rate-${selectedTrack.id}`} value={selectedTrack.tremoloRate ?? 5.0} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloRate: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.tremoloDepth ?? 0.5}</span></label><input type="range" min="0" max="1" step="0.05" data-testid={`tremolo-depth-${selectedTrack.id}`} value={selectedTrack.tremoloDepth ?? 0.5} disabled={isPlaying} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, tremoloDepth: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* EQ3 */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`eq-enable-${selectedTrack.id}`} checked={!!selectedTrack.eqEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            EQ3
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.eqEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Low</span><span>{selectedTrack.eqLow ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-low-${selectedTrack.id}`} value={selectedTrack.eqLow ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqLow: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Mid</span><span>{selectedTrack.eqMid ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-mid-${selectedTrack.id}`} value={selectedTrack.eqMid ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqMid: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>High</span><span>{selectedTrack.eqHigh ?? 0}dB</span></label><input type="range" min="-24" max="24" step="1" data-testid={`eq-high-${selectedTrack.id}`} value={selectedTrack.eqHigh ?? 0} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, eqHigh: parseFloat(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>

                        {/* Flanger */}
                        <details className="inspector-subgroup bg-[#1a1a1a] rounded border border-gray-800 overflow-hidden">
                          <summary className="text-sm font-medium flex items-center gap-2 text-gray-300 p-3 cursor-pointer">
                            <input type="checkbox" data-testid={`flanger-enable-${selectedTrack.id}`} checked={!!selectedTrack.flangerEnabled} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerEnabled: e.target.checked } : t) }))} className="accent-emerald-500" />
                            Flanger
                          </summary>
                          <div className="p-3 pt-0">
                          {selectedTrack.flangerEnabled && (
                            <div className="space-y-2 pl-6 mt-2">
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Speed</span><span>{selectedTrack.flangerSpeed ?? 0.5}</span></label><input type="range" min="0.1" max="5" step="0.1" data-testid={`flanger-speed-${selectedTrack.id}`} value={selectedTrack.flangerSpeed ?? 0.5} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerSpeed: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                              <div><label className="text-[10px] text-gray-500 flex justify-between"><span>Depth</span><span>{selectedTrack.flangerDepth ?? 0.002}</span></label><input type="range" min="0.001" max="0.01" step="0.001" data-testid={`flanger-depth-${selectedTrack.id}`} value={selectedTrack.flangerDepth ?? 0.002} onChange={(e) => setProject(prev => ({ ...prev, tracks: prev.tracks.map(t => t.id === selectedTrack.id ? { ...t, flangerDepth: Number(e.target.value) } : t) }))} className="w-full h-1 accent-emerald-500" /></div>
                            </div>
                          )}
                          </div>
                        </details>
                      </div>
                    )
                  })()}
                </div>
              </details>

              {/* Track management buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-800">
                <button data-testid="duplicate-track-btn" onClick={() => duplicateTrack(selectedTrackId)} disabled={isPlaying} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Duplicate Track</button>
                <button data-testid="move-up-btn" onClick={() => moveTrack(selectedTrackId, 'up')} disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === 0} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Move Up</button>
                <button data-testid="move-down-btn" onClick={() => moveTrack(selectedTrackId, 'down')} disabled={isPlaying || project.tracks.findIndex(t => t.id === selectedTrackId) === project.tracks.length - 1} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 transition-colors">Move Down</button>
                <button data-testid="delete-track-btn" onClick={() => deleteTrack(selectedTrackId)} disabled={isPlaying || project.tracks.length <= 1} className="danger-btn px-2 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50 transition-colors">Delete Track</button>
              </div>
            </div>
          </details>
        ) : (
          <div className="inspector-empty text-gray-500 text-sm" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}

        
        {allSelectedClipRefs.length > 1 ? (
          <details className="inspector-group sm" data-testid="inspector-clip-multi" open>
            <summary className="inspector-subtitle">Multi-Clip Settings ({allSelectedClipRefs.length} clips)</summary>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Volume (All)</label>
                <input
                  data-testid="multi-clip-gain-input"
                  type="range" min={0} max={200} step={1} defaultValue={100}
                  onMouseUp={(e) => {
                    const gain = Number((e.target as HTMLInputElement).value) / 100;
                    applyProjectUpdate(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => {
                        let changed = false;
                        const nextClips = t.clips.map(c => {
                          if (allSelectedClipRefs.some(r => r.clipId === c.id) && !t.locked) {
                            changed = true; return { ...c, gain };
                          }
                          return c;
                        });
                        return changed ? { ...t, clips: nextClips } : t;
                      })
                    }));
                  }}
                  disabled={isPlaying} className="w-full h-1 accent-emerald-500"
                />
              </div>
              
              <div>
                <label className="text-xs text-gray-500 block mb-1">Transpose (st) (All)</label>
                <input
                  data-testid="multi-clip-transpose-input"
                  type="number" min={-24} max={24} step={1} defaultValue={0}
                  onBlur={(e) => {
                    const st = Number((e.target as HTMLInputElement).value);
                    applyProjectUpdate(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => {
                        let changed = false;
                        const nextClips = t.clips.map(c => {
                          if (allSelectedClipRefs.some(r => r.clipId === c.id) && !t.locked) {
                            changed = true; return { ...c, transposeSemitones: st };
                          }
                          return c;
                        });
                        return changed ? { ...t, clips: nextClips } : t;
                      })
                    }));
                  }}
                  disabled={isPlaying} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fade In (All)</label>
                  <input
                    data-testid="multi-clip-fade-in-input"
                    type="number" min={0} step={0.1} defaultValue={0}
                    onBlur={(e) => {
                      const fadeIn = Number((e.target as HTMLInputElement).value);
                      applyProjectUpdate(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t => {
                          let changed = false;
                          const nextClips = t.clips.map(c => {
                            if (allSelectedClipRefs.some(r => r.clipId === c.id) && !t.locked) {
                              changed = true; return { ...c, fadeIn: Math.min(fadeIn, c.lengthBeats / 2) };
                            }
                            return c;
                          });
                          return changed ? { ...t, clips: nextClips } : t;
                        })
                      }));
                    }}
                    disabled={isPlaying} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Fade Out (All)</label>
                  <input
                    data-testid="multi-clip-fade-out-input"
                    type="number" min={0} step={0.1} defaultValue={0}
                    onBlur={(e) => {
                      const fadeOut = Number((e.target as HTMLInputElement).value);
                      applyProjectUpdate(prev => ({
                        ...prev,
                        tracks: prev.tracks.map(t => {
                          let changed = false;
                          const nextClips = t.clips.map(c => {
                            if (allSelectedClipRefs.some(r => r.clipId === c.id) && !t.locked) {
                              changed = true; return { ...c, fadeOut: Math.min(fadeOut, c.lengthBeats / 2) };
                            }
                            return c;
                          });
                          return changed ? { ...t, clips: nextClips } : t;
                        })
                      }));
                    }}
                    disabled={isPlaying} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200"
                  />
                </div>
              </div>

              <div className="clip-actions-group grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                <button
                  data-testid="multi-clip-mute-btn"
                  onClick={() => {
                    applyProjectUpdate(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => {
                        let changed = false;
                        const nextClips = t.clips.map(c => {
                          if (allSelectedClipRefs.some(r => r.clipId === c.id) && !t.locked) {
                            changed = true; return { ...c, muted: !c.muted };
                          }
                          return c;
                        });
                        return changed ? { ...t, clips: nextClips } : t;
                      })
                    }));
                  }}
                  disabled={isPlaying} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300"
                >
                  Toggle Mute All
                </button>
                <button
                  data-testid="multi-clip-delete-btn"
                  onClick={() => {
                    applyProjectUpdate(prev => ({
                      ...prev,
                      tracks: prev.tracks.map(t => {
                        if (t.locked) return t;
                        const nextClips = t.clips.filter(c => !allSelectedClipRefs.some(r => r.clipId === c.id));
                        return nextClips.length !== t.clips.length ? { ...t, clips: nextClips } : t;
                      })
                    }));
                  }}
                  disabled={isPlaying} className="danger-btn px-2 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50"
                >
                  Delete All
                </button>
              </div>
            </div>
          </details>
        ) : selectedClipData ? (
          <details className="inspector-group sm" data-testid="inspector-clip" open>
            <summary className="inspector-subtitle">Clip Settings</summary>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Name</label>
                <input data-testid="selected-clip-name-input" type="text" placeholder="Clip Name" value={selectedClipData.clip.name ?? ''} onChange={(e) => setClipName(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block mb-1">Color</label><input data-testid="selected-clip-color-picker" type="color" value={selectedClipData.clip.color || '#4299e1'} onChange={(e) => setClipColor(selectedClipData.track.id, selectedClipData.clip.id, e.target.value)} className="w-full h-7 bg-[#1a1a1a] border border-gray-800 rounded cursor-pointer" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Timbre (音色)</label><div className="grid grid-cols-2 gap-1" data-testid="selected-clip-wave-group">{[{val:'sine',label:'柔和'},{val:'square',label:'电子'},{val:'sawtooth',label:'锐利'},{val:'triangle',label:'温暖'},{val:'organ',label:'风琴'},{val:'brass',label:'铜管'}].map(w => <button key={w.val} data-testid={`wave-btn-${w.val}`} disabled={isPlaying || selectedClipData.track.locked} onClick={() => setSelectedClipWave(selectedClipData.track.id, selectedClipData.clip.id, w.val as WaveType)} onMouseEnter={() => { if (!isPlaying && !selectedClipData.track.locked) previewClip({ ...selectedClipData.clip, wave: w.val as WaveType }, selectedClipData.track) }} className={`px-1 py-1 text-[10px] rounded border ${selectedClipData.clip.wave === w.val ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-[#1a1a1a] border-gray-800 text-gray-400 hover:border-gray-600'} transition-colors truncate`}>{w.label}</button>)}</div></div>
              </div>
              <div><label className="text-xs text-gray-500 flex justify-between mb-1"><span>Volume</span><span>{Math.round((selectedClipData.clip.gain ?? 1.0) * 100)}%</span></label><input data-testid="selected-clip-gain-input" type="range" min={0} max={200} step={1} value={Math.round((selectedClipData.clip.gain ?? 1.0) * 100)} onChange={(e) => updateClipGain(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value) / 100)} disabled={isPlaying || selectedClipData.track.locked} className="w-full h-1 accent-emerald-500" /></div>
              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="clip-envelope-editor">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-500">Clip Envelope (Gain x)</label>
                  <button
                    data-testid="clip-envelope-reset-btn"
                    onClick={() => resetClipEnvelope(selectedClipData.track.id, selectedClipData.clip.id)}
                    disabled={isPlaying || selectedClipData.track.locked}
                    className="px-2 py-0.5 text-[10px] bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300"
                  >
                    Reset Line
                  </button>
                </div>
                {(selectedClipData.clip.envelope && selectedClipData.clip.envelope.length >= 3
                  ? selectedClipData.clip.envelope
                  : [
                      { beat: 0, gain: 1 },
                      { beat: selectedClipData.clip.lengthBeats / 2, gain: 1 },
                      { beat: selectedClipData.clip.lengthBeats, gain: 1 },
                    ]
                ).slice(0, 3).map((point, idx) => {
                  const pointName = idx === 0 ? 'Start' : idx === 1 ? 'Mid' : 'End'
                  return (
                    <div key={idx} className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">{pointName} Beat</label>
                        <input
                          data-testid={`clip-envelope-point-${idx}-beat`}
                          type="number"
                          min={0}
                          max={selectedClipData.clip.lengthBeats}
                          step={0.1}
                          value={Number(point.beat.toFixed(2))}
                          onChange={(e) => updateClipEnvelopePoint(selectedClipData.track.id, selectedClipData.clip.id, idx, { beat: Number(e.target.value) })}
                          disabled={isPlaying || selectedClipData.track.locked}
                          className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-gray-200"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-1">{pointName} Gain</label>
                        <input
                          data-testid={`clip-envelope-point-${idx}-gain`}
                          type="number"
                          min={0}
                          max={2}
                          step={0.05}
                          value={Number(point.gain.toFixed(2))}
                          onChange={(e) => updateClipEnvelopePoint(selectedClipData.track.id, selectedClipData.clip.id, idx, { gain: Number(e.target.value) })}
                          disabled={isPlaying || selectedClipData.track.locked}
                          className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-gray-200"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div><label className="text-xs text-gray-500 flex justify-between mb-1"><span>Transpose (st)</span><span>{selectedClipData.clip.transposeSemitones ?? 0}</span></label><input data-testid="selected-clip-transpose-input" type="number" min={-24} max={24} step={1} value={selectedClipData.clip.transposeSemitones ?? 0} onChange={(e) => updateClipTranspose(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Note</label><select data-testid="selected-clip-note-select" value={hzToClosestNoteLabel(selectedClipData.clip.noteHz)} onChange={(e) => { const note = SELECTABLE_NOTES.find(n => n.label === e.target.value); if (note) setSelectedClipNote(selectedClipData.track.id, selectedClipData.clip.id, note.hz); }} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200">{availableNotes.map(n => <option key={n.label} value={n.label}>{n.label}</option>)}</select></div>
              <div className="inspector-meta text-xs text-gray-600 font-mono" data-testid="selected-clip-scheduled-frequency">Scheduled: {selectedClipData.scheduledFrequencyHz.toFixed(2)} Hz</div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-xs text-gray-500 block mb-1">Length (beats)</label><input data-testid="selected-clip-length-input" type="number" min={1} max={32} step={1} value={selectedClipData.clip.lengthBeats} onChange={(e) => updateClipLengthBeats(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Fade In</label><input data-testid="selected-clip-fade-in-input" type="number" min={0} max={selectedClipData.clip.lengthBeats / 2} step={0.1} value={selectedClipData.clip.fadeIn ?? 0} onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value), selectedClipData.clip.fadeOut ?? 0)} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>
              </div>
              <div><label className="text-xs text-gray-500 block mb-1">Fade Out</label><input data-testid="selected-clip-fade-out-input" type="number" min={0} max={selectedClipData.clip.lengthBeats / 2} step={0.1} value={selectedClipData.clip.fadeOut ?? 0} onChange={(e) => updateClipFades(selectedClipData.track.id, selectedClipData.clip.id, selectedClipData.clip.fadeIn ?? 0, Number(e.target.value))} disabled={isPlaying || selectedClipData.track.locked} className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-sm focus:outline-none focus:border-emerald-500 text-gray-200" /></div>

              {selectedClipData.clip.audioData && (
                <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="audio-beat-align-panel">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">Audio Beat Align</label>
                    <span className="text-[10px] text-gray-500" data-testid="audio-beat-align-ratio">x{(selectedClipData.clip.audioStretchRatio ?? 1).toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      data-testid="audio-align-preserve-pitch-btn"
                      onClick={() => alignAudioClipToProjectBpm(selectedClipData.track.id, selectedClipData.clip.id, 'preservePitch')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.audioAlignMode !== 'preserveDuration' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      保持音高
                    </button>
                    <button
                      data-testid="audio-align-preserve-duration-btn"
                      onClick={() => alignAudioClipToProjectBpm(selectedClipData.track.id, selectedClipData.clip.id, 'preserveDuration')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.audioAlignMode === 'preserveDuration' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      保持时长
                    </button>
                  </div>
                </div>
              )}

              {selectedClipData.clip.audioData && (
                <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="vocal-timing-align-panel">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">Vocal Timing Align</label>
                    <span className="text-[10px] text-gray-500" data-testid="vocal-timing-align-mode">
                      {selectedClipData.clip.vocalTimingEnabled
                        ? selectedClipData.clip.vocalTimingMode === 'barStretch'
                          ? 'Bar Stretch'
                          : 'Grid Snap'
                        : 'Off'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      data-testid="vocal-align-grid-btn"
                      onClick={() => alignVocalClipTiming(selectedClipData.track.id, selectedClipData.clip.id, 'grid')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.vocalTimingEnabled && selectedClipData.clip.vocalTimingMode === 'grid' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      一键贴合网格
                    </button>
                    <button
                      data-testid="vocal-align-bar-stretch-btn"
                      onClick={() => alignVocalClipTiming(selectedClipData.track.id, selectedClipData.clip.id, 'barStretch')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.vocalTimingEnabled && selectedClipData.clip.vocalTimingMode === 'barStretch' ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      按小节轻度拉伸
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-gray-500" data-testid="vocal-align-ab-status">
                      A/B：{selectedClipData.clip.vocalTimingEnabled ? 'B=对齐后（A=回退前）' : 'A=原始'}
                    </div>
                    <button
                      data-testid="vocal-align-reset-btn"
                      onClick={() => resetVocalClipTimingAlign(selectedClipData.track.id, selectedClipData.clip.id)}
                      disabled={isPlaying || selectedClipData.track.locked || !selectedClipData.clip.vocalTimingEnabled}
                      className="px-2 py-0.5 text-[10px] bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 disabled:opacity-40"
                    >
                      回退当前片段
                    </button>
                  </div>
                </div>
              )}

              {selectedClipData.clip.audioData && (
                <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="vocal-pitch-assist-panel">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500">Vocal Pitch Assist</label>
                    <label className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                      <input
                        data-testid="vocal-pitch-enable-toggle"
                        type="checkbox"
                        checked={selectedClipData.clip.vocalPitchEnabled ?? false}
                        onChange={(e) => toggleVocalPitchAssist(selectedClipData.track.id, selectedClipData.clip.id, e.target.checked)}
                        disabled={isPlaying || selectedClipData.track.locked}
                      />
                      实时开关
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      data-testid="vocal-pitch-natural-btn"
                      onClick={() => applyVocalPitchAssist(selectedClipData.track.id, selectedClipData.clip.id, 'natural')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.vocalPitchEnabled && selectedClipData.clip.vocalPitchStyle === 'natural' ? 'bg-violet-500/20 border-violet-500 text-violet-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      轻度自然
                    </button>
                    <button
                      data-testid="vocal-pitch-pop-btn"
                      onClick={() => applyVocalPitchAssist(selectedClipData.track.id, selectedClipData.clip.id, 'pop')}
                      disabled={isPlaying || selectedClipData.track.locked}
                      className={`px-2 py-1 text-xs border rounded ${selectedClipData.clip.vocalPitchEnabled && selectedClipData.clip.vocalPitchStyle === 'pop' ? 'bg-violet-500/20 border-violet-500 text-violet-300' : 'bg-[#1a1a1a] border-gray-800 text-gray-300 hover:bg-gray-800'}`}
                    >
                      流行明显
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 flex justify-between mb-1">
                      <span>Dry / Wet</span>
                      <span data-testid="vocal-pitch-dry-wet-value">{Math.round((selectedClipData.clip.vocalPitchDryWet ?? 1) * 100)}%</span>
                    </label>
                    <input
                      data-testid="vocal-pitch-dry-wet"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round((selectedClipData.clip.vocalPitchDryWet ?? 1) * 100)}
                      onChange={(e) => setVocalPitchDryWet(selectedClipData.track.id, selectedClipData.clip.id, Number(e.target.value) / 100)}
                      disabled={isPlaying || selectedClipData.track.locked || !(selectedClipData.clip.vocalPitchEnabled ?? false)}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
              
              <div>
                <label className="text-xs text-gray-500 block mb-1">Quantize</label>
                <div className="grid grid-cols-3 gap-2">
                  <button data-testid="quantize-1-4-btn" onClick={() => quantizeClip(selectedClipData.track.id, selectedClipData.clip.id, 1)} disabled={isPlaying || selectedClipData.track.locked} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">1/4</button>
                  <button data-testid="quantize-1-8-btn" onClick={() => quantizeClip(selectedClipData.track.id, selectedClipData.clip.id, 0.5)} disabled={isPlaying || selectedClipData.track.locked} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">1/8</button>
                  <button data-testid="quantize-1-16-btn" onClick={() => quantizeClip(selectedClipData.track.id, selectedClipData.clip.id, 0.25)} disabled={isPlaying || selectedClipData.track.locked} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">1/16</button>
                </div>
              </div>

              <div className="inspector-meta text-xs text-gray-600 font-mono" data-testid="selected-clip-duplicate-target-beat">Duplicate target beat: {selectedClipData.duplicateStartBeat}</div>

              <div className="rounded border border-gray-800 bg-[#151515] p-2 space-y-2" data-testid="favorite-clips-panel">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs text-gray-500">Favorite Clips</label>
                  <button
                    type="button"
                    data-testid="favorite-clip-save-btn"
                    onClick={() => saveFavoriteClipFromSelection()}
                    disabled={isPlaying || selectedClipData.track.locked}
                    className="px-2 py-0.5 text-[10px] bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 disabled:opacity-40"
                  >
                    收藏当前 Clip
                  </button>
                </div>
                <input
                  data-testid="favorite-clip-search-input"
                  type="text"
                  value={favoriteClipSearchQuery}
                  onChange={(e) => setFavoriteClipSearchQuery(e.target.value)}
                  placeholder="搜索收藏（名称/调式/音高）"
                  className="w-full bg-[#1a1a1a] border border-gray-800 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 text-gray-200"
                />
                <div className="max-h-32 overflow-auto space-y-1" data-testid="favorite-clip-list">
                  {favoriteClips
                    .filter((item) => {
                      const q = favoriteClipSearchQuery.trim().toLowerCase()
                      if (!q) return true
                      return (`${item.name} ${item.scaleKey} ${item.scaleType} ${item.noteLabel}`).toLowerCase().includes(q)
                    })
                    .map((item) => (
                      <div key={item.id} className="rounded border border-gray-800 bg-[#111] px-2 py-1" data-testid={`favorite-clip-item-${item.id}`}>
                        <div className="text-[11px] text-gray-200 truncate">{item.name}</div>
                        <div className="text-[10px] text-gray-500">{item.durationBeats} beats · {item.scaleKey} {item.scaleType} · {item.noteLabel}</div>
                        <div className="mt-1 flex items-center gap-1">
                          <button
                            type="button"
                            data-testid={`favorite-clip-paste-${item.id}`}
                            onClick={() => selectedTrackId && pasteFavoriteClipToTrack(item.id, selectedTrackId)}
                            disabled={!selectedTrackId || isPlaying}
                            className="px-1.5 py-0.5 text-[10px] bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300 disabled:opacity-40"
                          >
                            粘贴到当前轨道
                          </button>
                          <button
                            type="button"
                            data-testid={`favorite-clip-delete-${item.id}`}
                            onClick={() => deleteFavoriteClip(item.id)}
                            className="px-1.5 py-0.5 text-[10px] bg-red-900/30 hover:bg-red-900/50 border border-red-900/50 rounded text-red-300"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  {favoriteClips.length === 0 && <div className="text-[10px] text-gray-500">暂无收藏 Clip</div>}
                </div>
              </div>

              <div className="clip-actions-group grid grid-cols-2 gap-2 pt-4 border-t border-gray-800">
                <button data-testid="selected-clip-mute-btn" onClick={() => toggleClipMute(selectedClipData.track.id, selectedClipData.clip.id)} disabled={isPlaying || selectedClipData.track.locked} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300" aria-pressed={selectedClipData.clip.muted}>{selectedClipData.clip.muted ? 'Unmute Clip' : 'Mute Clip'}</button>
                <button data-testid="selected-clip-delete-btn" onClick={() => deleteClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={isPlaying || selectedClipData.track.locked} className="danger-btn px-2 py-1 text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded border border-red-900/50">Delete Clip</button>
                <button data-testid="selected-clip-copy-btn" onClick={() => copyClip(selectedClipData.track.id, selectedClipData.clip.id)} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Copy Clip</button>
                <button data-testid="paste-clip-btn" onClick={() => { if (selectedTrackId) pasteClip(selectedTrackId) }} disabled={!selectedTrackId || !clipboard || isPlaying} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Paste Clip</button>
                <button data-testid="selected-clip-duplicate-btn" onClick={() => duplicateClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={!selectedClipData.canDuplicate} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Duplicate Clip</button>
                <button data-testid="selected-clip-split-btn" onClick={() => splitClip(selectedClipData.track.id, selectedClipData.clip.id)} disabled={!selectedClipData.canSplit} className="px-2 py-1 text-xs bg-[#1a1a1a] hover:bg-gray-800 border border-gray-800 rounded text-gray-300">Split Clip</button>
              </div>
            </div>
          </details>
        ) : (
          <div className="inspector-empty text-gray-500 text-sm" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}
      </div>
    </section>
  )
}
