import type { Clip, ClipEnvelopePoint, MasterEQ, Track } from '../types'
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

function createHighPassFilter(ctx: BaseAudioContext, cutoffHz: number) {
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = Math.max(40, Math.min(400, cutoffHz))
  hp.Q.value = 0.707
  return hp
}

function createDeEsserFilter(ctx: BaseAudioContext, amount: number) {
  const deEss = ctx.createBiquadFilter()
  deEss.type = 'peaking'
  deEss.frequency.value = 6500
  deEss.Q.value = 2.5
  deEss.gain.value = -Math.max(0, Math.min(10, amount * 10))
  return deEss
}

function applyVocalCleanChain(
  ctx: BaseAudioContext,
  input: AudioNode,
  track: Track,
): AudioNode {
  if (!track.vocalCleanEnabled) return input

  let node: AudioNode = input

  const denoiseAmount = track.vocalDenoiseAmount ?? 0.45
  const deEssAmount = track.vocalDeEssAmount ?? 0.5
  const compAmount = track.vocalCompAmount ?? 0.55
  const makeupGainDb = track.vocalMakeupGainDb ?? 2

  const hpCutoff = 60 + denoiseAmount * 180
  const hp = createHighPassFilter(ctx, hpCutoff)
  node.connect(hp)
  node = hp

  const deEss = createDeEsserFilter(ctx, deEssAmount)
  node.connect(deEss)
  node = deEss

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -28 + (1 - compAmount) * 20
  comp.ratio.value = 2 + compAmount * 6
  comp.attack.value = 0.003
  comp.release.value = 0.12
  node.connect(comp)
  node = comp

  const makeup = ctx.createGain()
  makeup.gain.value = Math.pow(10, Math.max(-3, Math.min(8, makeupGainDb)) / 20)
  node.connect(makeup)
  node = makeup

  return node
}

function normalizeEnvelope(envelope: ClipEnvelopePoint[] | undefined, clipLengthBeats: number): ClipEnvelopePoint[] {
  const fallback: ClipEnvelopePoint[] = [
    { beat: 0, gain: 1 },
    { beat: clipLengthBeats / 2, gain: 1 },
    { beat: clipLengthBeats, gain: 1 },
  ]
  const source = envelope && envelope.length >= 3 ? envelope : fallback
  return source
    .map((p) => ({
      beat: Math.max(0, Math.min(clipLengthBeats, p.beat)),
      gain: Math.max(0, Math.min(2, p.gain)),
    }))
    .sort((a, b) => a.beat - b.beat)
}

function getEnvelopeGainAtBeat(envelope: ClipEnvelopePoint[], beat: number): number {
  if (beat <= envelope[0].beat) return envelope[0].gain
  for (let i = 0; i < envelope.length - 1; i++) {
    const a = envelope[i]
    const b = envelope[i + 1]
    if (beat <= b.beat) {
      const span = Math.max(1e-6, b.beat - a.beat)
      const t = (beat - a.beat) / span
      return a.gain + (b.gain - a.gain) * t
    }
  }
  return envelope[envelope.length - 1].gain
}

export class AudioEngine {
  ctx: AudioContext | null = null
  masterGain: GainNode | null = null
  masterLimiter: DynamicsCompressorNode | null = null
  analyser: AnalyserNode | null = null

  private readonly masterVolumeCeiling = 0.9
  private readonly limiterThresholdDb = -3

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
      const limiter = ctx.createDynamicsCompressor()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      masterGain.gain.value = Math.min(this.masterVolumeCeiling, masterVolume)
      limiter.threshold.value = this.limiterThresholdDb
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.003
      limiter.release.value = 0.08
      masterGain.connect(limiter)
      limiter.connect(analyser)
      analyser.connect(ctx.destination)

      this.ctx = ctx
      this.masterGain = masterGain
      this.masterLimiter = limiter
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
      this.masterGain.gain.value = Math.min(this.masterVolumeCeiling, volume)
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
    masterEQ?: MasterEQ,
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
      masterEQ,
    );
    
    return await offlineCtx.startRendering();
  }

  async exportWav(
    tracks: Track[],
    bpm: number,
    timelineBeats: number,
    tempoCurveType: TempoCurveType = 'constant',
    tempoCurveTargetBpm?: number,
    masterEQ?: MasterEQ,
  ): Promise<ArrayBuffer> {
    const renderedBuffer = await this.renderBuffer(tracks, bpm, timelineBeats, tempoCurveType, tempoCurveTargetBpm, masterEQ);
    
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
    masterEQ?: MasterEQ,
  ) {
    const ctx = customCtx || this.ctx
    const master = customMaster || this.masterGain
    if (!ctx || !master) return

    const masterBus = ctx.createGain()
    masterBus.gain.value = 1

    const masterEqLow = ctx.createBiquadFilter()
    masterEqLow.type = 'lowshelf'
    masterEqLow.frequency.value = 250
    masterEqLow.gain.value = masterEQ?.low ?? 0

    const masterEqMid = ctx.createBiquadFilter()
    masterEqMid.type = 'peaking'
    masterEqMid.frequency.value = 1000
    masterEqMid.Q.value = 1
    masterEqMid.gain.value = masterEQ?.mid ?? 0

    const masterEqHigh = ctx.createBiquadFilter()
    masterEqHigh.type = 'highshelf'
    masterEqHigh.frequency.value = 4000
    masterEqHigh.gain.value = masterEQ?.high ?? 0

    masterBus.connect(masterEqLow)
    masterEqLow.connect(masterEqMid)
    masterEqMid.connect(masterEqHigh)
    masterEqHigh.connect(master)

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
        clickGain.connect(masterBus)

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
          
          currentOutput.connect(masterBus);
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
          const buffer = this.audioBufferCache.get(clip.id)!
          const clipDurationSec = Math.max(0.001, clipEnd - clipStart)
          const preserveDurationRate = buffer.duration > 0 ? buffer.duration / clipDurationSec : 1
          const stretchRate = clip.audioAlignMode === 'preserveDuration'
            ? preserveDurationRate
            : 1
          bufferSource.buffer = buffer
          bufferSource.playbackRate.value = semitoneToRatio(track.transposeSemitones + (clip.transposeSemitones || 0)) * stretchRate
          osc = bufferSource
        } else {
          const synthOsc = ctx.createOscillator()
          applyWaveType(ctx, synthOsc, clip.wave)
          synthOsc.frequency.value = scheduledFrequencyHz
          osc = synthOsc
        }

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

        const envelope = normalizeEnvelope(clip.envelope, clip.lengthBeats)
        const eventBeats = Array.from(new Set([0, ...envelope.map((p) => p.beat), clip.lengthBeats])).sort((a, b) => a - b)
        gain.gain.setValueAtTime(0.0001, clipStart)
        for (let i = 0; i < eventBeats.length; i++) {
          const beatOffset = eventBeats[i]
          const eventTime = clipStart + beatToSeconds(clip.startBeat + beatOffset, tempoSettings, loopBeats) - beatToSeconds(clip.startBeat, tempoSettings, loopBeats)
          const envelopeGain = getEnvelopeGainAtBeat(envelope, beatOffset)
          const target = Math.max(0.0001, effectiveTrackVolume * envelopeGain)
          if (i === 0) {
            gain.gain.setValueAtTime(target, eventTime)
          } else {
            gain.gain.linearRampToValueAtTime(target, eventTime)
          }
        }

        const fadeInEnd = Math.min(clipStart + actualFadeIn, clipEnd)
        const fadeOutStart = Math.max(clipStart, clipEnd - actualFadeOut)
        const fadeInEnvelope = Math.max(0.0001, effectiveTrackVolume * getEnvelopeGainAtBeat(envelope, Math.min(clip.lengthBeats, clip.fadeIn || 0)))
        const fadeOutEnvelope = Math.max(0.0001, effectiveTrackVolume * getEnvelopeGainAtBeat(envelope, Math.max(0, clip.lengthBeats - (clip.fadeOut || 0))))
        gain.gain.linearRampToValueAtTime(Math.max(0.0001, fadeInEnvelope), fadeInEnd)
        gain.gain.setValueAtTime(Math.max(0.0001, fadeOutEnvelope), fadeOutStart)
        gain.gain.linearRampToValueAtTime(0.0001, clipEnd)
        panner.pan.value = Math.max(-1, Math.min(1, track.pan))

        filter.type = track.filterType === 'highpass' ? 'highpass' : 'lowpass'
        filter.frequency.value = track.filterCutoff ?? 20000

        osc.connect(gain)
        gain.connect(panner)

        let trackOutput: AudioNode = panner

        // Vocal clean chain (noise reduction + de-esser + compression + make-up gain)
        trackOutput = applyVocalCleanChain(ctx, trackOutput, track)

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
          delayNode.connect(masterBus)
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
          wetGain.connect(masterBus)
        }

        trackOutput.connect(masterBus)

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
    this.masterLimiter = null
    this.analyser = null
  }
}

export const audioEngine = new AudioEngine()
