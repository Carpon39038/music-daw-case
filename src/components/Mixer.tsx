import type { DAWActions } from '../hooks/useDAWActions'

export function Mixer({
  meterCanvasRef,
  masterEQ,
  setMasterEQ,
}: Pick<DAWActions, 'meterCanvasRef' | 'masterEQ' | 'setMasterEQ'>) {
  return (
    <section className="meter">
      <div className="meter-main">
        <div className="meter-label">Master Output Meter</div>
        <canvas ref={meterCanvasRef} width={320} height={16} />
      </div>
      <details className="master-eq-collapse">
        <summary>Master EQ</summary>
        <div className="master-eq-controls">
          <label>L: <input type="range" min="-12" max="12" value={masterEQ.low} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, low: Number(e.target.value)}))} data-testid="master-eq-low" /></label>
          <label>M: <input type="range" min="-12" max="12" value={masterEQ.mid} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, mid: Number(e.target.value)}))} data-testid="master-eq-mid" /></label>
          <label>H: <input type="range" min="-12" max="12" value={masterEQ.high} onChange={e => setMasterEQ((prev: { low: number; mid: number; high: number }) => ({...prev, high: Number(e.target.value)}))} data-testid="master-eq-high" /></label>
        </div>
      </details>
    </section>
  )
}
