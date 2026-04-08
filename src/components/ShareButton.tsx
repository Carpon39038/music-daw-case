import { Share } from 'lucide-react'
import { useState } from 'react'
import { useDAWStore } from '../store/useDAWStore'
import { encodeSharePayload } from '../utils/shareLink'

export function ShareButton() {
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const state = useDAWStore.getState()
    const payload = {
      project: state.project,
      masterVolume: state.masterVolume,
      masterEQ: state.masterEQ,
      loopEnabled: state.loopEnabled,
      loopLengthBeats: state.loopLengthBeats
    }
    
    const hash = encodeSharePayload(payload)
    const url = new URL(window.location.href)
    url.hash = `share=${hash}`
    
    void navigator.clipboard.writeText(url.toString())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleShare}
      className={`p-2 rounded flex items-center gap-1 text-xs font-medium transition-colors ${
        copied 
          ? 'bg-green-500/20 text-green-400' 
          : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
      }`}
      title="Share Project Link"
    >
      <Share size={14} />
      {copied ? 'Copied Link' : 'Share'}
    </button>
  )
}
