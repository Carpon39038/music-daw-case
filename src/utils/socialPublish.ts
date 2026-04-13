import { zipSync } from 'fflate'
import type { ProjectState, PublishWizardTemplate, ReleaseMetadata } from '../types'

function sanitizeFileName(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return 'music-daw-project'
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'music-daw-project'
}

export function normalizeReleaseMetadata(
  value: Partial<ReleaseMetadata> | null | undefined,
  projectName?: string,
): ReleaseMetadata {
  const title = (value?.title || projectName || 'Untitled Project').trim() || 'Untitled Project'
  const author = (value?.author || '').trim()
  const cover = (value?.cover || '').trim()
  const rawTags = Array.isArray(value?.tags) ? value.tags : []
  const tags = rawTags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 8)
  return {
    title,
    author,
    cover,
    tags,
    updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

export function parseReleaseTags(input: string): string[] {
  return input
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 8)
}

export function releaseTagsToText(tags: string[]): string {
  return tags.join(', ')
}

export function isReleaseMetadataReady(metadata: Partial<ReleaseMetadata> | null | undefined): boolean {
  if (!metadata) return false
  return Boolean(metadata.title?.trim() && metadata.author?.trim() && metadata.cover?.trim() && metadata.tags && metadata.tags.length > 0)
}

function dedupeNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function isPublishTemplateReady(value: Partial<PublishWizardTemplate> | null | undefined): boolean {
  return Boolean(
    value
    && Array.isArray(value.titleCandidates)
    && value.titleCandidates.filter((item) => item && String(item).trim()).length > 0
    && value.coverCopy
    && value.coverCopy.trim()
    && value.platformDescriptions?.shortVideo?.trim()
    && value.platformDescriptions?.podcast?.trim()
    && value.platformDescriptions?.musicPlatform?.trim(),
  )
}

export function normalizePublishTemplate(
  value: Partial<PublishWizardTemplate> | null | undefined,
  projectName: string,
  metadata: ReleaseMetadata,
): PublishWizardTemplate {
  const titleCandidates = dedupeNonEmpty([
    ...(Array.isArray(value?.titleCandidates) ? value!.titleCandidates : []),
    metadata.title,
    `${metadata.title} (${new Date().getFullYear()})`,
    `${projectName || metadata.title} Demo`,
  ]).slice(0, 5)

  const shortTag = metadata.tags.slice(0, 2).join(' / ') || '原创音乐'
  const fallbackCoverCopy = `${metadata.title}｜${metadata.author} 的最新作品，欢迎收听。`

  return {
    titleCandidates: titleCandidates.length > 0 ? titleCandidates : [metadata.title],
    coverCopy: (value?.coverCopy || fallbackCoverCopy).trim() || fallbackCoverCopy,
    platformDescriptions: {
      shortVideo: (value?.platformDescriptions?.shortVideo || `🎧 ${metadata.title} #${shortTag.replace(/\s+/g, '')}`).trim(),
      podcast: (value?.platformDescriptions?.podcast || `本期分享原创作品《${metadata.title}》，作者 ${metadata.author}。风格：${metadata.tags.join('、') || '未标注'}。`).trim(),
      musicPlatform: (value?.platformDescriptions?.musicPlatform || `单曲《${metadata.title}》已完成发布准备。关键词：${metadata.tags.join(' / ') || '原创'}`).trim(),
    },
    updatedAt: typeof value?.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

function formatDuration(totalSeconds: number) {
  const mins = Math.floor(totalSeconds / 60)
  const secs = Math.max(0, Math.round(totalSeconds % 60))
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function buildSocialExportBaseName(projectName?: string) {
  const date = new Date()
  const timestamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
  return `${sanitizeFileName(projectName || 'music-daw-project')}-${timestamp}`
}

export function createSocialCardBlob(
  project: ProjectState,
  totalDurationSec: number,
  metadataOverride?: Partial<ReleaseMetadata> | null,
): Promise<Blob> {
  const metadata = normalizeReleaseMetadata(metadataOverride ?? project.releaseMetadata, project.name)
  const width = 1200
  const height = 630
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context unavailable')
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#111827')
  gradient.addColorStop(1, '#0f766e')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
  for (let i = 0; i < 48; i++) {
    const x = 80 + i * 22
    const h = 60 + ((i * 37) % 180)
    ctx.fillRect(x, height - 120 - h, 12, h)
  }

  ctx.fillStyle = '#e5e7eb'
  ctx.font = '700 56px sans-serif'
  ctx.fillText(metadata.title || 'Untitled Project', 72, 140)

  ctx.fillStyle = '#a7f3d0'
  ctx.font = '500 30px sans-serif'
  ctx.fillText(`By ${metadata.author || 'Unknown Artist'} • Music DAW Case`, 72, 188)

  const clipCount = project.tracks.reduce((sum, track) => sum + track.clips.length, 0)
  const statItems = [
    `BPM ${project.bpm}`,
    `Tracks ${project.tracks.length}`,
    `Clips ${clipCount}`,
    `Length ${formatDuration(totalDurationSec)}`,
  ]

  ctx.font = '600 28px sans-serif'
  ctx.fillStyle = '#d1d5db'
  statItems.forEach((item, idx) => {
    ctx.fillText(item, 72, 280 + idx * 52)
  })

  ctx.fillStyle = '#34d399'
  ctx.fillRect(72, 520, 320, 10)
  ctx.fillStyle = '#e5e7eb'
  ctx.font = '400 22px sans-serif'
  const coverLabel = metadata.cover ? `Cover: ${metadata.cover}` : 'Cover: N/A'
  ctx.fillText(coverLabel, 72, 560)
  const tagsLabel = metadata.tags.length > 0 ? `Tags: ${metadata.tags.join(' / ')}` : 'Tags: N/A'
  ctx.fillText(tagsLabel, 72, 590)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create card blob'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export async function createSocialPackageZipBlob(
  baseName: string,
  mp3Blob: Blob,
  coverBlob: Blob,
): Promise<Blob> {
  const [mp3Ab, coverAb] = await Promise.all([mp3Blob.arrayBuffer(), coverBlob.arrayBuffer()])
  const zipData = zipSync({
    [`${baseName}.mp3`]: new Uint8Array(mp3Ab),
    [`${baseName}-cover.png`]: new Uint8Array(coverAb),
  })
  const zipArrayBuffer = new ArrayBuffer(zipData.byteLength)
  new Uint8Array(zipArrayBuffer).set(zipData)
  return new Blob([zipArrayBuffer], { type: 'application/zip' })
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  const win = window as typeof window & { __TEST_DOWNLOADS__?: string[] }
  if (!Array.isArray(win.__TEST_DOWNLOADS__)) {
    win.__TEST_DOWNLOADS__ = []
  }
  win.__TEST_DOWNLOADS__.push(fileName)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
