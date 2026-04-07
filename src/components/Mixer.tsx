import { useEffect, useState } from 'react'
import type { DAWActions } from '../hooks/useDAWActions'
import { audioEngine } from '../audio/AudioEngine'

export function Mixer({
  masterVolume,
  setMasterVolume,
  masterEQ,
  setMasterEQ,
}: Pick<DAWActions, 'masterVolume' | 'setMasterVolume' | 'masterEQ' | 'setMasterEQ'>) {
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
    <section className="meter h-48 bg-[#111] border-t border-gray-800 flex p-4 gap-8 flex-shrink-0" data-testid="mixer">
      {/* Master Volume */}
      <div className="flex flex-col items-center w-24">
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

      {/* Master EQ */}
      <div className="flex flex-col w-64 border-l border-gray-800 pl-8">
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
