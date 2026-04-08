import { useEffect, useState } from 'react'
import { useDAWStore } from '../store/useDAWStore'

export function IdleHint() {
  const [show, setShow] = useState(false)
  const isPlaying = useDAWStore(state => state.isPlaying)
  
  useEffect(() => {
    // Hide in E2E tests automatically
    if (navigator.webdriver) return;
    
    let timeout: ReturnType<typeof setTimeout>

    const resetTimer = () => {
      setShow(false)
      clearTimeout(timeout)
      
      // If already playing, don't show idle hint
      if (useDAWStore.getState().isPlaying) return;
      
      timeout = setTimeout(() => {
        if (!localStorage.getItem('hasSeenDemoHint') && localStorage.getItem('hasSeenOnboarding')) {
          // Only show if there are very few clips (meaning it's basically an empty project)
          const project = useDAWStore.getState().project;
          const totalClips = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
          if (totalClips <= 4) {
            setShow(true)
          }
        }
      }, 10000)
    }

    resetTimer()

    window.addEventListener('click', resetTimer)
    window.addEventListener('keydown', resetTimer)
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('click', resetTimer)
      window.removeEventListener('keydown', resetTimer)
    }
  }, [isPlaying]) // Re-run when isPlaying changes to hide/reset timer
  
  if (!show) return null
  
  return (
     <div className="fixed top-16 right-4 z-50 bg-[#164e63] text-white px-4 py-3 rounded-lg shadow-2xl border border-cyan-500/50 flex items-start gap-3 animate-bounce">
       <div>
         <p className="font-bold text-sm mb-1">不知道怎么开始？</p>
         <p className="text-xs text-cyan-200">试着点击右上方的「Load Demo...」加载一首预设歌曲！</p>
       </div>
       <button 
         onClick={(e) => { 
           e.stopPropagation(); 
           setShow(false); 
           localStorage.setItem('hasSeenDemoHint', 'true') 
         }} 
         className="text-cyan-300 hover:text-white"
       >
         ✕
       </button>
     </div>
  )
}
