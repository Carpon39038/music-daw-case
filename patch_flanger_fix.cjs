const fs = require('fs');
const appPath = './src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

const badLogic = `
        if (track.flangerEnabled) {
          const flangerDelay = ctx.createDelay(0.02)
          flangerDelay.delayTime.value = 0.005
          
          const osc = ctx.createOscillator()
          osc.type = 'sine'
          osc.frequency.value = track.flangerSpeed ?? 0.5
          
          const depth = ctx.createGain()
          depth.gain.value = track.flangerDepth ?? 0.002
          
          osc.connect(depth)
          depth.connect(flangerDelay.delayTime)
          osc.start(startTime)
          activeOscillators.push(osc)
          
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
`;

const fixedLogic = `
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
`;

if (code.includes('activeOscillators.push(osc)')) {
  code = code.replace(badLogic, fixedLogic);
  fs.writeFileSync(appPath, code);
  console.log('Fixed Flanger logic');
} else {
  console.log('Flanger logic not found or already fixed');
}
