import { useEffect, useState } from 'react'
import type { DAWActions } from '../hooks/useDAWActions'
import { audioEngine } from '../audio/AudioEngine'

const PRESET_OPTIONS: Array<{ key: DAWActions['masterPreset']; label: string }> = [
  { key: 'none', label: 'RAW' },
  { key: 'clean', label: 'CLEAN' },
  { key: 'loud', label: 'LOUD' },
  { key: 'warm', label: 'WARM' },
  { key: 'bright', label: 'BRIGHT' },
]

export function Mixer({
  masterVolume,
  setMasterVolume,
  masterEQ,
  setMasterEQ,
  masterPreset,
  applyMasterPreset,
  resetMasterPresetToBaseline,
  busGroups,
  setBusGroupVolume,
  toggleBusGroupMute,
  toggleBusGroupSolo,
  setBusGroupEQEnabled,
  setBusGroupEQBand,
  setBusGroupCompressorEnabled,
  setBusGroupCompressorParam,
}: Pick<DAWActions, 'masterVolume' | 'setMasterVolume' | 'masterEQ' | 'setMasterEQ' | 'masterPreset' | 'applyMasterPreset' | 'resetMasterPresetToBaseline' | 'busGroups' | 'setBusGroupVolume' | 'toggleBusGroupMute' | 'toggleBusGroupSolo' | 'setBusGroupEQEnabled' | 'setBusGroupEQBand' | 'setBusGroupCompressorEnabled' | 'setBusGroupCompressorParam'>) {
  const [rms, setRms] = useState(0)

  useEffect(() => {
    let animationFrame: number

    const updateMeter = () => {
      setRms(audioEngine.getRMS())
      animationFrame = requestAnimationFrame(updateMeter)
    }

    updateMeter()
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  // Convert RMS to dB roughly, then to percentage for meter height
  const db = 20 * Math.log10(Math.max(rms, 0.0001))
  const meterHeight = Math.max(0, Math.min(100, (db + 60) * (100 / 60)))

  return (
    <section className="meter h-48 bg-[#111] border-t border-gray-800 flex min-w-0 p-4 gap-8 flex-shrink-0 overflow-x-auto" data-testid="mixer">
      {/* Master Volume */}
      <div className="flex flex-col items-center w-24 shrink-0">
        <span className="text-xs text-gray-500 font-medium mb-2">MASTER</span>
        <div className="flex-1 flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
            data-testid="master-volume"
            className="h-full w-1.5 appearance-none bg-gray-800 rounded-full accent-emerald-500"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
          />

          {/* Level Meter */}
          <div className="w-3 h-full bg-gray-900 rounded-sm overflow-hidden relative flex flex-col justify-end border border-gray-800">
            {/* Meter Gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-500 via-yellow-500 to-red-500 opacity-20" />

            {/* Active Level */}
            <div
              className="w-full bg-gradient-to-t from-emerald-500 via-yellow-500 to-red-500 transition-all duration-75"
              style={{ height: `${meterHeight}%` }}
            />
          </div>
        </div>
        <span className="master-volume-value text-[10px] text-gray-600 mt-2">{Math.round(masterVolume * 100)}%</span>
      </div>

      {/* Bus Groups */}
      <div className="flex flex-col w-[28rem] border-l border-gray-800 pl-6 pr-2 overflow-y-auto shrink-0" data-testid="bus-group-mixer">
        <span className="text-xs text-gray-500 font-medium mb-2">BUS GROUPS</span>
        <div className="grid grid-cols-2 gap-2">
          {busGroups.map((group) => (
            <div key={group.id} className="rounded border border-gray-800 bg-[#0d0d0d] p-2" data-testid={`bus-group-${group.id}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-300 font-medium">{group.name}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid={`bus-mute-${group.id}`}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${group.muted ? 'bg-red-900/40 text-red-300' : 'bg-gray-800 text-gray-400'}`}
                    onClick={() => toggleBusGroupMute(group.id)}
                  >M</button>
                  <button
                    type="button"
                    data-testid={`bus-solo-${group.id}`}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${group.solo ? 'bg-yellow-900/40 text-yellow-300' : 'bg-gray-800 text-gray-400'}`}
                    onClick={() => toggleBusGroupSolo(group.id)}
                  >S</button>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] text-gray-500">VOL</span>
                <input
                  data-testid={`bus-vol-${group.id}`}
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  value={group.volume}
                  onChange={(e) => setBusGroupVolume(group.id, Number(e.target.value))}
                  className="flex-1 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-[10px] text-gray-600 w-10 text-right">{Math.round(group.volume * 100)}%</span>
              </div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[10px] text-gray-500 inline-flex items-center gap-1">
                  <input
                    data-testid={`bus-eq-enabled-${group.id}`}
                    type="checkbox"
                    checked={Boolean(group.eqEnabled)}
                    onChange={(e) => setBusGroupEQEnabled(group.id, e.target.checked)}
                  />EQ
                </label>
                <input data-testid={`bus-eq-low-${group.id}`} type="range" min={-12} max={12} step={0.1} value={group.eqLow ?? 0} onChange={(e) => setBusGroupEQBand(group.id, 'low', Number(e.target.value))} className="w-14 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                <input data-testid={`bus-eq-mid-${group.id}`} type="range" min={-12} max={12} step={0.1} value={group.eqMid ?? 0} onChange={(e) => setBusGroupEQBand(group.id, 'mid', Number(e.target.value))} className="w-14 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                <input data-testid={`bus-eq-high-${group.id}`} type="range" min={-12} max={12} step={0.1} value={group.eqHigh ?? 0} onChange={(e) => setBusGroupEQBand(group.id, 'high', Number(e.target.value))} className="w-14 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-[10px] text-gray-500 inline-flex items-center gap-1">
                  <input
                    data-testid={`bus-comp-enabled-${group.id}`}
                    type="checkbox"
                    checked={Boolean(group.compressorEnabled)}
                    onChange={(e) => setBusGroupCompressorEnabled(group.id, e.target.checked)}
                  />COMP
                </label>
                <input data-testid={`bus-comp-threshold-${group.id}`} type="range" min={-60} max={0} step={1} value={group.compressorThreshold ?? -24} onChange={(e) => setBusGroupCompressorParam(group.id, 'threshold', Number(e.target.value))} className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
                <input data-testid={`bus-comp-ratio-${group.id}`} type="range" min={1} max={20} step={0.1} value={group.compressorRatio ?? 3} onChange={(e) => setBusGroupCompressorParam(group.id, 'ratio', Number(e.target.value))} className="w-16 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Master EQ */}
      <div className="flex flex-col w-80 border-l border-gray-800 pl-8 shrink-0">
        <div className="mb-3">
          <span className="text-xs text-gray-500 font-medium">MASTER PRESET</span>
          <div className="grid grid-cols-5 gap-1 mt-2" data-testid="master-preset-pack">
            {PRESET_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  if (option.key === 'none') {
                    resetMasterPresetToBaseline()
                    return
                  }
                  applyMasterPreset(option.key)
                }}
                data-testid={`master-preset-${option.key}`}
                className={`text-[10px] rounded px-1.5 py-1 border transition-colors ${masterPreset === option.key ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200' : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {masterPreset !== 'none' && (
            <div className="text-[10px] text-emerald-300 mt-1" data-testid="master-preset-active-label">
              Active: {masterPreset.toUpperCase()} preset
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 font-medium mb-4">MASTER EQ</span>
        <div className="flex justify-between flex-1">
          <div className="flex flex-col items-center">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.1}
              value={masterEQ.low}
              onChange={(e) => setMasterEQ({ ...masterEQ, low: Number(e.target.value) })}
              data-testid="master-eq-low"
              className="h-20 w-1.5 appearance-none bg-gray-800 rounded-full accent-emerald-500"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
            <span className="text-[10px] text-gray-500 mt-2">LOW</span>
            <span className="text-[10px] text-gray-600">{masterEQ.low > 0 ? '+' : ''}{masterEQ.low.toFixed(1)}dB</span>
          </div>

          <div className="flex flex-col items-center">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.1}
              value={masterEQ.mid}
              onChange={(e) => setMasterEQ({ ...masterEQ, mid: Number(e.target.value) })}
              data-testid="master-eq-mid"
              className="h-20 w-1.5 appearance-none bg-gray-800 rounded-full accent-emerald-500"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
            <span className="text-[10px] text-gray-500 mt-2">MID</span>
            <span className="text-[10px] text-gray-600">{masterEQ.mid > 0 ? '+' : ''}{masterEQ.mid.toFixed(1)}dB</span>
          </div>

          <div className="flex flex-col items-center">
            <input
              type="range"
              min={-12}
              max={12}
              step={0.1}
              value={masterEQ.high}
              onChange={(e) => setMasterEQ({ ...masterEQ, high: Number(e.target.value) })}
              data-testid="master-eq-high"
              className="h-20 w-1.5 appearance-none bg-gray-800 rounded-full accent-emerald-500"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
            <span className="text-[10px] text-gray-500 mt-2">HIGH</span>
            <span className="text-[10px] text-gray-600">{masterEQ.high > 0 ? '+' : ''}{masterEQ.high.toFixed(1)}dB</span>
          </div>
        </div>
      </div>
    </section>
  )
}
