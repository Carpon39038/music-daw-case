const fs = require('fs')

let code = fs.readFileSync('src/App.tsx', 'utf8')

const previewFunction = `
  const previewClip = async (clip, track) => {
    if (isPlaying) return;
    await ensureAudio();
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const filter = ctx.createBiquadFilter();

    osc.type = clip.wave;
    osc.frequency.value = clip.noteHz;

    gain.gain.setValueAtTime(0, ctx.currentTime);
    const finalGain = Math.pow(10, clip.gain / 20) * track.volume;
    if (track.muted || finalGain <= 0.001) return;

    // simple envelope
    gain.gain.linearRampToValueAtTime(finalGain, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + Math.min(clip.lengthBeats * beatDuration, 1.0));

    panner.pan.value = track.pan || 0;
    
    // We can skip heavy effects for preview to be fast, but let's connect through basic chain.
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(master);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + Math.min(clip.lengthBeats * beatDuration, 1.0));
  }
`

if (!code.includes('const previewClip =')) {
  code = code.replace('const startPlayback = async () => {', previewFunction + '\n  const startPlayback = async () => {');
}

// Now replace onClick
code = code.replace(/onClick=\{\(\) => \{\n\s+setSelectedTrackId\(track.id\)\n\s+setSelectedClipRef\(\{ trackId: track.id, clipId: clip.id \}\)\n\s+\}\}/, `onClick={() => {
                    setSelectedTrackId(track.id)
                    setSelectedClipRef({ trackId: track.id, clipId: clip.id })
                    previewClip(clip, track)
                  }}`)

fs.writeFileSync('src/App.tsx', code)
