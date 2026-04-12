import { Mp3Encoder } from 'lamejs';

export function audioBufferToMp3(buffer: AudioBuffer, options?: { kbps?: number }): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const kbps = Math.max(64, Math.min(320, Math.round(options?.kbps ?? 128)));
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);
  
  const mp3Data: Int8Array[] = [];
  
  // Convert Float32Array to Int16Array
  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  
  const sampleBlockSize = 1152; // multiple of 576
  for (let i = 0; i < left.length; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize);
    const rightChunk = right.subarray(i, i + sampleBlockSize);
    
    const leftInt16 = new Int16Array(leftChunk.length);
    const rightInt16 = new Int16Array(rightChunk.length);
    
    for (let j = 0; j < leftChunk.length; j++) {
      const sl = Math.max(-1, Math.min(1, leftChunk[j]));
      const sr = Math.max(-1, Math.min(1, rightChunk[j]));
      leftInt16[j] = sl < 0 ? sl * 0x8000 : sl * 0x7FFF;
      rightInt16[j] = sr < 0 ? sr * 0x8000 : sr * 0x7FFF;
    }
    
    let mp3buf;
    if (numChannels === 1) {
      // lamejs signature: encodeBuffer(left: Int16Array, right?: Int16Array)
      // but if 1 channel, maybe just pass left
      mp3buf = encoder.encodeBuffer(leftInt16);
    } else {
      mp3buf = encoder.encodeBuffer(leftInt16, rightInt16);
    }
    
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  
  const mp3buf = encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }
  
  const totalLength = mp3Data.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result.buffer;
}
