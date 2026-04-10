import type { Clip, Track } from '../types'
import { beatToSeconds, getTimelineDurationSec, type TempoCurveType } from '../utils/tempoCurve'

function applyWaveType(ctx: BaseAudioContext, osc: OscillatorNode, waveType: string) {
  if (["sine", "square", "sawtooth", "triangle"].includes(waveType)) {
    osc.type = waveType as OscillatorType;
  } else if (waveType === "organ") {
    const real = new Float32Array([0, 0.8, 0.6, 0.6, 0.5, 0.4, 0.3, 0.2]);
    const imag = new Float32Array(real.length);
    const wave = ctx.createPeriodicWave(real, imag);
    osc.setPeriodicWave(wave);
  } else if (waveType === "brass") {
    const real = new Float32Array([0, 1, 0.2, 0.8, 0.1, 0.4, 0.05, 0.2]);
    const imag = new Float32Array(real.length);
    const wave = ctx.createPeriodicWave(real, imag);
    osc.setPeriodicWave(wave);
  } else {
    osc.type = "sine";
  }
}

function semitoneToRatio(semitones: number) {
  return 2 ** (semitones / 12)
}

function createReverbIR(ctx: BaseAudioContext, durationSec: number, sampleRate?: number): AudioBuffer {
  const sr = sampleRate ?? ctx.sampleRate
  const length = Math.max(1, Math.floor(sr * durationSec))
  const buffer = ctx.createBuffer(2, length, sr)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2)
    }
  }
  return buffer
}

function makeDistortionCurve(amount = 50) {
  const k = typeof amount === 'number' ? amount : 50
  const n_samples = 44100
  const curve = new Float32Array(n_samples)
  const deg = Math.PI / 180
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x))
  }
  return curve
}

export class AudioEngine {
  ctx: AudioContext | null = null
  masterGain: GainNode | null = null
  analyser: AnalyserNode | null = null

  scheduledNodes: Array<{ osc: AudioScheduledSourceNode; gain: GainNode }> = []
  scheduledFrequencyPreview: number[] = []
  startTime = 0

  mediaRecorder: MediaRecorder | null = null
  recordedChunks: BlobPart[] = []
  audioBufferCache: Map<string, AudioBuffer> = new Map()

  async loadClipAudio(clipId: string, audioData: string) {
    if (!this.ctx) return
    if (this.audioBufferCache.has(clipId)) return
    try {
      const res = await fetch(audioData)
      const ab = await res.arrayBuffer()
      const buffer = await this.ctx.decodeAudioData(ab)
      this.audioBufferCache.set(clipId, buffer)
    } catch (err) {
      console.error('Failed to load clip audio', err)
    }
  }

  async ensureAudio(masterVolume: number) {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const masterGain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      masterGain.gain.value = masterVolume
      masterGain.connect(analyser)
      analyser.connect(ctx.destination)

      this.ctx = ctx
      this.masterGain = masterGain
      this.analyser = analyser
    }

    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  async startRecordingMic() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.mediaRecorder = new MediaRecorder(stream)
    this.recordedChunks = []
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data)
    }
    this.mediaRecorder.start()
  }

  async stopRecordingMic(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null)
      this.mediaRecorder.onstop = () => {
        resolve(new Blob(this.recordedChunks, { type: 'audio/webm' }))
      }
      this.mediaRecorder.stop()
    })
  }

  setMasterVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume
    }
  }

  clearScheduledNodes() {
    this.scheduledFrequencyPreview = []
    this.scheduledNodes.forEach(({ osc, gain }) => {
      try { osc.stop() } catch { /* ignore */ }
      try { osc.disconnect(); gain.disconnect() } catch { /* ignore */ }
    })
    this.scheduledNodes = []
  }

  async renderBuffer(
    tracks: Track[],
    bpm: number,
    timelineBeats: number,
    tempoCurveType: TempoCurveType = 'constant',
    tempoCurveTargetBpm?: number,
  ): Promise<AudioBuffer> {
    const durationSec = getTimelineDurationSec(timelineBeats, {
      bpm,
      curveType: tempoCurveType,
      targetBpm: tempoCurveTargetBpm,
    });
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * durationSec), sampleRate);
    
    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(offlineCtx.destination);
    
    this.scheduleProject(
      tracks,
      bpm,
      false,
      timelineBeats,
      false,
      timelineBeats,
      tempoCurveType,
      tempoCurveTargetBpm,
      offlineCtx,
      masterGain,
    );
    
    return await offlineCtx.startRendering();
  }

  async exportWav(
    tracks: Track[],
    bpm: number,
    timelineBeats: number,
    tempoCurveType: TempoCurveType = 'constant',
    tempoCurveTargetBpm?: number,
  ): Promise<ArrayBuffer> {
    const renderedBuffer = await this.renderBuffer(tracks, bpm, timelineBeats, tempoCurveType, tempoCurveTargetBpm);
    
    const numChannels = renderedBuffer.numberOfChannels;
    const format = 1;
    const bitDepth = 16;
    const sampleRate = renderedBuffer.sampleRate;
    
    const result = new Float32Array(renderedBuffer.length * numChannels);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = renderedBuffer.getChannelData(channel);
      for (let i = 0; i < renderedBuffer.length; i++) {
        result[i * numChannels + channel] = channelData[i];
      }
    }

    const dataLength = result.length * (bitDepth / 8);
    const bufferArray = new ArrayBuffer(44 + dataLength);
    const view = new DataView(bufferArray);

    const writeString = (v: DataView, off: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(off + i, str.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < result.length; i++) {
      let s = Math.max(-1, Math.min(1, result[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, s, true);
      offset += 2;
    }

    return bufferArray;
  }

  scheduleProject(
    tracks: Track[],
    bpm: number,
    loopEnabled: boolean,
    loopLengthBeats: number,
    metronomeEnabled: boolean,
    timelineBeats: number,
    tempoCurveType: TempoCurveType = 'constant',
    tempoCurveTargetBpm?: number,
    customCtx?: BaseAudioContext,
    customMaster?: GainNode,
  ) {
    const ctx = customCtx || this.ctx
    const master = customMaster || this.masterGain
    if (!ctx || !master) return

    const soloActive = tracks.some((t) => t.solo)
    const loopBeats = loopEnabled ? loopLengthBeats : timelineBeats
    const tempoSettings = { bpm, curveType: tempoCurveType, targetBpm: tempoCurveTargetBpm }
    const loopDurationSec = getTimelineDurationSec(loopBeats, tempoSettings)
    const startAt = ctx.currentTime + (customCtx ? 0 : 0.05)
    if (!customCtx) this.startTime = startAt

    // Metronome
    if (metronomeEnabled) {
      for (let i = 0; i < loopBeats; i++) {
        const beatTime = startAt + beatToSeconds(i, tempoSettings, loopBeats)
        const clickOsc = ctx.createOscillator()
        const clickGain = ctx.createGain()

        clickOsc.type = 'square'
        clickOsc.frequency.value = i % 4 === 0 ? 880 : 440

        clickGain.gain.setValueAtTime(0, beatTime)
        clickGain.gain.linearRampToValueAtTime(0.3, beatTime + 0.005)
        clickGain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.05)

        clickOsc.connect(clickGain)
        clickGain.connect(master)

        clickOsc.start(beatTime)
        clickOsc.stop(beatTime + 0.05)

        if (!customCtx) { this.scheduledNodes.push({ osc: clickOsc, gain: clickGain }) }
      }
    }

        tracks.forEach((track) => {
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
          for (let i = 0; i < totalSteps; i++) {
             const stepBeat = i / 4;
             const stepStart = startAt + beatToSeconds(stepBeat, tempoSettings, loopBeats);
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

      track.clips.forEach((clip) => {
        if (clip.startBeat >= loopBeats) return

        const clipOffsetSec = beatToSeconds(clip.startBeat, tempoSettings, loopBeats)
        const clipEndSec = beatToSeconds(clip.startBeat + clip.lengthBeats, tempoSettings, loopBeats)
        const clipDurationSec = Math.min(loopDurationSec - clipOffsetSec, clipEndSec - clipOffsetSec)
        if (clipDurationSec <= 0) return

        let osc: AudioScheduledSourceNode
        const gain = ctx.createGain()
        const panner = ctx.createStereoPanner()
        const filter = ctx.createBiquadFilter()

        const clipStart = startAt + clipOffsetSec
        const clipEnd = clipStart + clipDurationSec
        
        const scheduledFrequencyHz = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))

        if (clip.audioData && this.audioBufferCache.has(clip.id)) {
          const bufferSource = ctx.createBufferSource()
          bufferSource.buffer = this.audioBufferCache.get(clip.id)!
          bufferSource.playbackRate.value = semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))
          osc = bufferSource
        } else {
          const synthOsc = ctx.createOscillator()
          applyWaveType(ctx, synthOsc, clip.wave)
          synthOsc.frequency.value = scheduledFrequencyHz
          osc = synthOsc
        }

        gain.gain.setValueAtTime(0.0001, clipStart)
        const isTrackAudible = !track.muted && (!soloActive || track.solo)
        const clipGain = clip.gain ?? 1.0
        const effectiveTrackVolume = isTrackAudible ? (track.volume * clipGain) : 0

        const beatAtClipStart = clip.startBeat
        const fadeInSec = (clip.fadeIn || 0) > 0
          ? beatToSeconds(beatAtClipStart + (clip.fadeIn || 0), tempoSettings, loopBeats) - beatToSeconds(beatAtClipStart, tempoSettings, loopBeats)
          : 0
        const fadeOutSec = (clip.fadeOut || 0) > 0
          ? beatToSeconds(clip.startBeat + clip.lengthBeats, tempoSettings, loopBeats) - beatToSeconds(clip.startBeat + clip.lengthBeats - (clip.fadeOut || 0), tempoSettings, loopBeats)
          : 0
        const actualFadeIn = fadeInSec > 0 ? fadeInSec : 0.01
        const actualFadeOut = fadeOutSec > 0 ? fadeOutSec : 0.02

        gain.gain.linearRampToValueAtTime(effectiveTrackVolume * 0.15, Math.min(clipStart + actualFadeIn, clipEnd))
        gain.gain.setValueAtTime(effectiveTrackVolume * 0.15, Math.max(clipStart + actualFadeIn, clipEnd - actualFadeOut))
        gain.gain.linearRampToValueAtTime(0.0001, clipEnd)
        panner.pan.value = Math.max(-1, Math.min(1, track.pan))

        filter.type = track.filterType === 'highpass' ? 'highpass' : 'lowpass'
        filter.frequency.value = track.filterCutoff ?? 20000

        osc.connect(gain)
        gain.connect(panner)

        let trackOutput: AudioNode = panner

        // Chorus
        if (track.chorusEnabled) {
          const chorus = ctx.createDelay()
          chorus.delayTime.value = 0.03

          const depth = ctx.createGain()
          depth.gain.value = track.chorusDepth ?? 0.5

          const lfo = ctx.createOscillator()
          lfo.type = 'sine'
          lfo.frequency.value = track.chorusRate ?? 1.5

          lfo.connect(depth)
          depth.connect(chorus.delayTime)
          lfo.start(clipStart)
          lfo.stop(clipEnd)

          const dryGain = ctx.createGain()
          dryGain.gain.value = 1
          const wetGain = ctx.createGain()
          wetGain.gain.value = 0.5

          trackOutput.connect(dryGain)
          trackOutput.connect(chorus)
          chorus.connect(wetGain)

          const mix = ctx.createGain()
          dryGain.connect(mix)
          wetGain.connect(mix)

          trackOutput = mix
        }

        // Compressor
        if (track.compressorEnabled) {
          const compressor = ctx.createDynamicsCompressor()
          compressor.threshold.value = track.compressorThreshold ?? -24
          compressor.ratio.value = track.compressorRatio ?? 12
          trackOutput.connect(compressor)
          trackOutput = compressor
        }

        // Filter
        if (track.filterType && track.filterType !== 'none') {
          panner.connect(filter)
          trackOutput = filter
        }

        // EQ3
        if (track.eqEnabled) {
          const eqLow = ctx.createBiquadFilter()
          eqLow.type = 'lowshelf'
          eqLow.frequency.value = 250
          eqLow.gain.value = track.eqLow ?? 0

          const eqMid = ctx.createBiquadFilter()
          eqMid.type = 'peaking'
          eqMid.frequency.value = 1000
          eqMid.Q.value = 1
          eqMid.gain.value = track.eqMid ?? 0

          const eqHigh = ctx.createBiquadFilter()
          eqHigh.type = 'highshelf'
          eqHigh.frequency.value = 4000
          eqHigh.gain.value = track.eqHigh ?? 0

          trackOutput.connect(eqLow)
          eqLow.connect(eqMid)
          eqMid.connect(eqHigh)
          trackOutput = eqHigh
        }

        // Flanger
        if (track.flangerEnabled) {
          const flangerDelay = ctx.createDelay(0.02)
          flangerDelay.delayTime.value = 0.005

          const flangerLfo = ctx.createOscillator()
          flangerLfo.type = 'sine'
          flangerLfo.frequency.value = track.flangerSpeed ?? 0.5

          const flangerDepthNode = ctx.createGain()
          flangerDepthNode.gain.value = track.flangerDepth ?? 0.002

          flangerLfo.connect(flangerDepthNode)
          flangerDepthNode.connect(flangerDelay.delayTime)
          flangerLfo.start(clipStart)
          flangerLfo.stop(clipEnd)

          const fbGain = ctx.createGain()
          fbGain.gain.value = track.flangerFeedback ?? 0.5

          trackOutput.connect(flangerDelay)
          flangerDelay.connect(fbGain)
          fbGain.connect(flangerDelay)

          const wetGain = ctx.createGain()
          wetGain.gain.value = 0.5
          const dryGain = ctx.createGain()
          dryGain.gain.value = 0.5

          trackOutput.connect(dryGain)
          flangerDelay.connect(wetGain)

          const mix = ctx.createGain()
          dryGain.connect(mix)
          wetGain.connect(mix)

          trackOutput = mix
        }

        // Delay
        if (track.delayEnabled) {
          const delayNode = ctx.createDelay(5.0)
          delayNode.delayTime.value = track.delayTime ?? 0.3
          const feedbackGain = ctx.createGain()
          feedbackGain.gain.value = track.delayFeedback ?? 0.4

          trackOutput.connect(delayNode)
          delayNode.connect(feedbackGain)
          feedbackGain.connect(delayNode)
          delayNode.connect(master)
        }

        // Tremolo
        if (track.tremoloEnabled) {
          const tremoloGain = ctx.createGain()
          tremoloGain.gain.value = 1 - (track.tremoloDepth ?? 0.5) / 2

          const lfo = ctx.createOscillator()
          lfo.type = 'sine'
          lfo.frequency.value = track.tremoloRate ?? 5.0

          const lfoGain = ctx.createGain()
          lfoGain.gain.value = (track.tremoloDepth ?? 0.5) / 2

          lfo.connect(lfoGain)
          lfoGain.connect(tremoloGain.gain)

          lfo.start(clipStart)
          lfo.stop(clipEnd)

          trackOutput.connect(tremoloGain)
          trackOutput = tremoloGain
        }

        // Distortion (WaveShaper)
        if (track.distortionEnabled) {
          const distortion = ctx.createWaveShaper()
          distortion.curve = makeDistortionCurve(400)
          distortion.oversample = '4x'
          trackOutput.connect(distortion)
          trackOutput = distortion
        }

        // Reverb (ConvolverNode)
        if (track.reverbEnabled) {
          const convolver = ctx.createConvolver()
          const decay = Math.max(0.1, track.reverbDecay ?? 2)
          convolver.buffer = createReverbIR(ctx, decay)
          const wetGain = ctx.createGain()
          wetGain.gain.value = track.reverbMix ?? 0.3
          trackOutput.connect(convolver)
          convolver.connect(wetGain)
          wetGain.connect(master)
        }

        trackOutput.connect(master)

        osc.start(clipStart)
        osc.stop(clipEnd)

        if (!customCtx) {
          this.scheduledFrequencyPreview.push(scheduledFrequencyHz)
          this.scheduledNodes.push({ osc, gain })
        }
      })
    })
  }

  async previewClip(
    clip: Clip,
    track: Track,
    bpm: number,
    tempoCurveType: TempoCurveType = 'constant',
    tempoCurveTargetBpm?: number,
  ) {
    if (!this.ctx || !this.masterGain) return

    const ctx = this.ctx
    const master = this.masterGain

    let osc: AudioScheduledSourceNode
    const gain = ctx.createGain()
    const panner = ctx.createStereoPanner()

    if (clip.audioData && this.audioBufferCache.has(clip.id)) {
      const bufferSource = ctx.createBufferSource()
      bufferSource.buffer = this.audioBufferCache.get(clip.id)!
      bufferSource.playbackRate.value = semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))
      osc = bufferSource
    } else {
      const synthOsc = ctx.createOscillator()
      applyWaveType(ctx, synthOsc, clip.wave)
      synthOsc.frequency.value = clip.noteHz * semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0))
      osc = synthOsc
    }

    gain.gain.setValueAtTime(0, ctx.currentTime)
    const clipGain = clip.gain ?? 1.0
    const finalGain = clipGain * track.volume
    if (track.muted || finalGain <= 0.001) return

    const previewDuration = Math.min(
      beatToSeconds(clip.lengthBeats, { bpm, curveType: tempoCurveType, targetBpm: tempoCurveTargetBpm }, clip.lengthBeats),
      1.0,
    )
    gain.gain.linearRampToValueAtTime(finalGain, ctx.currentTime + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + previewDuration)

    panner.pan.value = track.pan || 0

    osc.connect(gain)
    gain.connect(panner)
    panner.connect(master)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + previewDuration)
  }

  getRMS(): number {
    if (!this.analyser) return 0
    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteTimeDomainData(dataArray)
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] - 128) / 128
      sum += v * v
    }
    return Math.sqrt(sum / bufferLength)
  }

  getElapsed() {
    if (!this.ctx) return 0
    return Math.max(0, this.ctx.currentTime - this.startTime)
  }

  destroy() {
    this.clearScheduledNodes()
    this.ctx?.close()
    this.ctx = null
    this.masterGain = null
    this.analyser = null
  }
}

export const audioEngine = new AudioEngine()
