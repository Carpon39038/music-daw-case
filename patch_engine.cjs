const fs = require('fs');
let code = fs.readFileSync('src/audio/AudioEngine.ts', 'utf-8');

// Find tracks.forEach
const target = `tracks.forEach((track) => {`;
const trackInit = `    tracks.forEach((track) => {
      const isTrackAudible = !track.muted && (!soloActive || track.solo)
      let trackOutputNode: AudioNode | null = null;
      let trackInputNode: GainNode | null = null;

      if (track.isDrumTrack && track.drumSequence && isTrackAudible) {
          trackInputNode = ctx.createGain();
          trackInputNode.gain.value = track.volume;
          
          const panner = ctx.createStereoPanner();
          panner.pan.value = Math.max(-1, Math.min(1, track.pan || 0));
          trackInputNode.connect(panner);
          let currentOutput: AudioNode = panner;

          // EQ3
          if (track.eqEnabled) {
            const eqLow = ctx.createBiquadFilter(); eqLow.type = 'lowshelf'; eqLow.frequency.value = 250; eqLow.gain.value = track.eqLow ?? 0;
            const eqMid = ctx.createBiquadFilter(); eqMid.type = 'peaking'; eqMid.frequency.value = 1000; eqMid.Q.value = 1; eqMid.gain.value = track.eqMid ?? 0;
            const eqHigh = ctx.createBiquadFilter(); eqHigh.type = 'highshelf'; eqHigh.frequency.value = 4000; eqHigh.gain.value = track.eqHigh ?? 0;
            currentOutput.connect(eqLow); eqLow.connect(eqMid); eqMid.connect(eqHigh); currentOutput = eqHigh;
          }
          
          currentOutput.connect(master);
          trackOutputNode = trackInputNode;

          const seq = track.drumSequence;
          const totalSteps = loopBeats * 4;
          const stepDurationSec = beatDuration / 4;
          for (let i = 0; i < totalSteps; i++) {
             const stepOffsetSec = i * stepDurationSec;
             const stepStart = startAt + stepOffsetSec;
             const seqIndex = i % 16;
             
             if (seq.kick[seqIndex]) {
               const osc = ctx.createOscillator();
               const gain = ctx.createGain();
               osc.frequency.setValueAtTime(150, stepStart);
               osc.frequency.exponentialRampToValueAtTime(0.01, stepStart + 0.1);
               gain.gain.setValueAtTime(1, stepStart);
               gain.gain.exponentialRampToValueAtTime(0.01, stepStart + 0.1);
               osc.connect(gain);
               gain.connect(trackOutputNode);
               osc.start(stepStart);
               osc.stop(stepStart + 0.1);
               if (!customCtx) this.scheduledNodes.push({ osc, gain });
             }
             if (seq.snare[seqIndex]) {
               const osc = ctx.createOscillator();
               const gain = ctx.createGain();
               osc.type = 'triangle';
               osc.frequency.setValueAtTime(250, stepStart);
               gain.gain.setValueAtTime(1, stepStart);
               gain.gain.exponentialRampToValueAtTime(0.01, stepStart + 0.1);
               osc.connect(gain);
               gain.connect(trackOutputNode);
               osc.start(stepStart);
               osc.stop(stepStart + 0.1);
               if (!customCtx) this.scheduledNodes.push({ osc, gain });
             }
             if (seq.hihat[seqIndex]) {
               const osc = ctx.createOscillator();
               const gain = ctx.createGain();
               osc.type = 'square';
               osc.frequency.setValueAtTime(8000, stepStart);
               gain.gain.setValueAtTime(0.3, stepStart);
               gain.gain.exponentialRampToValueAtTime(0.01, stepStart + 0.05);
               
               const filter = ctx.createBiquadFilter();
               filter.type = 'highpass';
               filter.frequency.value = 7000;
               
               osc.connect(filter);
               filter.connect(gain);
               gain.connect(trackOutputNode);
               osc.start(stepStart);
               osc.stop(stepStart + 0.05);
               if (!customCtx) this.scheduledNodes.push({ osc, gain });
             }
          }
      }
`;
code = code.replace(target, trackInit);
fs.writeFileSync('src/audio/AudioEngine.ts', code);
console.log('patched');
