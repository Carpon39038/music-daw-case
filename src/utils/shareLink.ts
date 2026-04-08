import { strFromU8, strToU8, zlibSync, unzlibSync } from 'fflate'
import type { ProjectState, MasterEQ } from '../types'

interface SharePayload {
  project: ProjectState
  masterVolume: number
  masterEQ: MasterEQ
  loopEnabled: boolean
  loopLengthBeats: number
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload)
  const compressed = zlibSync(strToU8(json))
  // Convert to base64
  let binary = ''
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function decodeSharePayload(base64Str: string): SharePayload | null {
  try {
    const b64 = base64Str.replace(/-/g, '+').replace(/_/g, '/') + '==='.substring(0, (3 - (base64Str.length % 3)) % 3)
    const binary = atob(b64)
    const compressed = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      compressed[i] = binary.charCodeAt(i)
    }
    const decompressed = unzlibSync(compressed)
    return JSON.parse(strFromU8(decompressed)) as SharePayload
  } catch (err) {
    console.error('Failed to decode share payload', err)
    return null
  }
}
