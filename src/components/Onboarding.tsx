import { useState } from 'react'

export function Onboarding() {
  const [isOpen, setIsOpen] = useState(() => {
    // Hide onboarding in E2E tests automatically
    if (navigator.webdriver) return false;
    return !localStorage.getItem('hasSeenOnboarding')
  })
  const [step, setStep] = useState(0)

  const handleClose = () => {
    setIsOpen(false)
    localStorage.setItem('hasSeenOnboarding', 'true')
  }

  if (!isOpen) return null

  const steps = [
    {
      title: "欢迎来到 Music DAW 🎵",
      desc: "零基础也能轻松做音乐！跟我来了解最基本的三个操作吧。"
    },
    {
      title: "第一步：添加轨道",
      desc: "点击左侧的【+】或【添加鼓点轨道】来创建新的乐器轨道。"
    },
    {
      title: "第二步：选择音色",
      desc: "选中一个音符（Clip），在右侧面板修改它的波形或音高。"
    },
    {
      title: "第三步：播放试听",
      desc: "点击顶部的播放按钮，或者按下【空格键】，听听看你的作品！"
    }
  ]

  const currentStep = steps[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" data-testid="onboarding-modal">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 max-w-md w-full shadow-2xl relative">
        <h2 className="text-2xl font-bold text-white mb-4">{currentStep.title}</h2>
        <p className="text-gray-300 text-lg mb-8 leading-relaxed">{currentStep.desc}</p>
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-2">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full ${i === step ? 'bg-cyan-500' : 'bg-gray-600'}`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            {step > 0 && (
              <button 
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                上一步
              </button>
            )}
            {step < steps.length - 1 ? (
              <button 
                onClick={() => setStep(s => s + 1)}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors font-medium"
              >
                下一步
              </button>
            ) : (
              <button 
                onClick={handleClose}
                className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium"
                data-testid="onboarding-finish"
              >
                开始创作！
              </button>
            )}
          </div>
        </div>
        
        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
          data-testid="onboarding-skip"
        >
          跳过
        </button>
      </div>
    </div>
  )
}
