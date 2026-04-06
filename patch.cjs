const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Refactor Transport
const transportStart = code.indexOf('<section className="transport" data-testid="transport">');
const transportEnd = code.indexOf('</section>', transportStart) + '</section>'.length;
const newTransport = `<section className="transport" data-testid="transport" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="transport-primary" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button data-testid="play-btn" onClick={startPlayback} disabled={isPlaying}>Play</button>
          <button data-testid="pause-btn" onClick={pausePlayback} disabled={!isPlaying}>Pause</button>
          <button data-testid="stop-btn" onClick={stopPlayback}>Stop</button>
          
          <label>
            BPM
            <input
              data-testid="bpm-input"
              type="number"
              min={60}
              max={200}
              value={project.bpm}
              onChange={(e) => setProject({ ...project, bpm: Number(e.target.value) || 120 })}
              disabled={isPlaying}
              style={{ width: '60px' }}
            />
          </label>

          <label>
            Loop
            <input
              data-testid="loop-enabled"
              type="checkbox"
              checked={loopEnabled}
              onChange={(e) => setLoopEnabled(e.target.checked)}
              disabled={isPlaying}
            />
          </label>

          <label>
            Beats
            <select
              data-testid="loop-length"
              value={loopLengthBeats}
              onChange={(e) => setLoopLengthBeats(Number(e.target.value))}
              disabled={isPlaying || !loopEnabled}
            >
              {[4, 8, 12, 16].map((beats) => (
                <option key={beats} value={beats}>{beats}</option>
              ))}
            </select>
          </label>

          <label>
            Vol
            <input
              data-testid="master-volume"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              style={{ width: '80px' }}
            />
          </label>

          <div className="status" style={{ marginLeft: 'auto' }}>Playhead: {playheadBeat.toFixed(2)}</div>
        </div>

        <details className="transport-advanced">
          <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#9cb4d8' }}>Advanced Controls</summary>
          <div className="transport-secondary" style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
            <button data-testid="metronome-btn" onClick={() => setMetronomeEnabled(v => !v)} aria-pressed={metronomeEnabled}>{metronomeEnabled ? 'Metronome: ON' : 'Metronome: OFF'}</button>
            <button data-testid="undo-btn" onClick={undo} disabled={undoStackRef.current.length === 0 || isPlaying}>Undo</button>
            <button data-testid="redo-btn" onClick={redo} disabled={redoStackRef.current.length === 0 || isPlaying}>Redo</button>
            <button data-testid="reset-project-btn" onClick={() => {
              applyProjectUpdate(() => createInitialProject())
              undoStackRef.current = []
              redoStackRef.current = []
              try { window.localStorage.removeItem(PROJECT_STORAGE_KEY) } catch {}
            }} disabled={isPlaying}>Reset</button>

            <label>
              <input data-testid="midi-import-input" type="file" accept=".mid,.midi" onChange={handleMIDIImport} disabled={isPlaying} style={{ display: 'none' }} />
              <button data-testid="midi-import-btn" onClick={() => document.querySelector('[data-testid="midi-import-input"]')?.click()} disabled={isPlaying}>Import MIDI</button>
            </label>
            <button data-testid="midi-export-btn" onClick={handleMIDIExport} disabled={isPlaying}>Export MIDI</button>
            <button data-testid="tap-tempo-btn" onClick={handleTapTempo} disabled={isPlaying}>Tap Tempo</button>
          </div>
        </details>
      </section>`;

code = code.substring(0, transportStart) + newTransport + code.substring(transportEnd);

// 2. Refactor Meter (Master EQ collapse)
const meterStart = code.indexOf('<section className="meter">');
const meterEnd = code.indexOf('</section>', meterStart) + '</section>'.length;
const newMeter = `<section className="meter" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div className="meter-main" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="meter-label">Master Output Meter</div>
          <canvas ref={meterCanvasRef} width={320} height={16} />
        </div>
        <details className="master-eq-collapse">
          <summary style={{ cursor: 'pointer', fontSize: '12px', color: '#9cb4d8' }}>Master EQ</summary>
          <div className="master-eq-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
            <label>L: <input type="range" min="-12" max="12" value={masterEQ.low} onChange={e => setMasterEQ((prev) => ({...prev, low: Number(e.target.value)}))} data-testid="master-eq-low" /></label>
            <label>M: <input type="range" min="-12" max="12" value={masterEQ.mid} onChange={e => setMasterEQ((prev) => ({...prev, mid: Number(e.target.value)}))} data-testid="master-eq-mid" /></label>
            <label>H: <input type="range" min="-12" max="12" value={masterEQ.high} onChange={e => setMasterEQ((prev) => ({...prev, high: Number(e.target.value)}))} data-testid="master-eq-high" /></label>
          </div>
        </details>
      </section>`;
code = code.substring(0, meterStart) + newMeter + code.substring(meterEnd);

// 3. Refactor Track Header
const headerStart = code.indexOf('<div className="track-header-main"');
// we need to replace all track-header-main
code = code.replace(/<div className="track-header-main"[\s\S]*?<\/div>(\s*)<\/div>/g, (match, p1) => {
  return `<div className="track-header-main" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              <div className="track-header-row1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="track-name" style={{ color: track.color || "#e2e8f0", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>{track.name}</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  Vol
                  <input data-testid={\`vol-\${track.id}\`} type="range" min={0} max={1} step={0.01} value={track.volume} onChange={(e) => setTrackVolume(track.id, Number(e.target.value))} disabled={isPlaying} style={{ width: '60px' }} />
                </label>
              </div>
              <div className="track-header-row2" style={{ display: 'flex', gap: '4px' }}>
                <button data-testid={\`mute-\${track.id}\`} onClick={() => toggleTrackMute(track.id)} disabled={isPlaying} aria-pressed={track.muted} style={{ padding: '4px 6px', fontSize: '11px', flex: 1, backgroundColor: track.muted ? '#ff5d5d' : undefined, color: track.muted ? '#fff' : undefined }}>{track.muted ? 'M' : 'M'}</button>
                <button data-testid={\`solo-\${track.id}\`} onClick={() => toggleTrackSolo(track.id)} disabled={isPlaying} aria-pressed={track.solo} style={{ padding: '4px 6px', fontSize: '11px', flex: 1, backgroundColor: track.solo ? '#eab308' : undefined, color: track.solo ? '#fff' : undefined }}>{track.solo ? 'S' : 'S'}</button>
                <button data-testid={\`lock-\${track.id}\`} onClick={() => toggleTrackLock(track.id)} disabled={isPlaying} aria-pressed={track.locked} style={{ padding: '4px 6px', fontSize: '11px', flex: 1, backgroundColor: track.locked ? '#ef4444' : undefined, color: track.locked ? '#fff' : undefined }}>{track.locked ? 'L' : 'L'}</button>
                <button data-testid={\`add-clip-\${track.id}\`} onClick={() => addClip(track.id)} disabled={isPlaying || track.locked} style={{ padding: '4px 6px', fontSize: '11px', flex: 1 }}>+</button>
              </div>
            </div>
            </div>`;
});

fs.writeFileSync('src/App.tsx', code);
