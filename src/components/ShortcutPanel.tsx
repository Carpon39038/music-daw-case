import { useState, useEffect } from 'react'

export function ShortcutPanel() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle on Shift + ?
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        // don't trigger if inside input
        const target = e.target as HTMLElement
        const tagName = target?.tagName?.toLowerCase()
        if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return
        
        setIsOpen(prev => !prev)
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center font-bold shadow-lg border border-gray-700 z-40 transition-colors"
        title="键盘快捷键 (Keyboard Shortcuts)"
        data-testid="shortcut-panel-trigger"
      >
        ?
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-800">
              <h2 className="text-lg font-bold text-gray-100">键盘快捷键</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4">
              <ul className="space-y-3">
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">播放 / 暂停</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Space</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">停止并返回开头</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">S</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">撤销 (Undo)</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Cmd/Ctrl + Z</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">重做 (Redo)</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Cmd/Ctrl + Shift + Z</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">复制 Clip</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Cmd/Ctrl + C</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">粘贴 Clip</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Cmd/Ctrl + V</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">删除选中的 Clip</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Backspace / Delete</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">多选 Clip</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">Shift + Click</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-gray-300">打开此面板</span>
                  <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded text-sm font-mono border border-gray-700">?</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
