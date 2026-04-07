import type { DAWActions } from '../hooks/useDAWActions'

export function Mixer({
  meterCanvasRef,
  masterEQ,
  setMasterEQ,
}: Pick<DAWActions, 'meterCanvasRef' | 'masterEQ' | 'setMasterEQ'>) {
  return (
    <section className="meter h-48 bg-[#111] border-t border-gray-800 flex items-start p-4 gap-8 flex-shrink-0">
      <div className="meter-main flex flex-col gap-2">
        <div className="meter-label text-xs text-gray-500 uppercase font-semibold">Master Output Meter</div>
        <canvas ref={meterCanvasRef} width={320} height={16} className="border border-gray-800 rounded bg-[#0a0a0a]" />
      </div>
      <details className="master-eq-collapse">
        <summary className="text-xs text-gray-500 cursor-pointer">Master EQ</summary>
        <div className="master-eq-controls flex gap-4 mt-2">
          <label className="flex flex-col items-center gap-2 text-[10px] text-gray-500">
            L:
            <input type="range" min="-12" max="12" value={masterEQ.low} onChange={e => setMasterEQ((prev) => ({ ...prev, low: Number(e.target.value) }))} data-testid="master-eq-low" className="master-eq-slider" style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 100, width: 16, accentColor: '#00d992' }} />
          </label>
          <label className="flex flex-col items-center gap-2 text-[10px] text-gray-500">
            M:
            <input type="range" min="-12" max="12" value={masterEQ.mid} onChange={e => setMasterEQ((prev) => ({ ...prev, mid: Number(e.target.value) }))} data-testid="master-eq-mid" style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 100, width: 16, accentColor: '#00d992' }} />
          </label>
          <label className="flex flex-col items-center gap-2 text-[10px] text-gray-500">
            H:
            <input type="range" min="-12" max="12" value={masterEQ.high} onChange={e => setMasterEQ((prev) => ({ ...prev, high: Number(e.target.value) }))} data-testid="master-eq-high" style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 100, width: 16, accentColor: '#00d992' }} />
          </label>
        </div>
      </details>
    </section>
  )
}
