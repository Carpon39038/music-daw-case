const fs = require('fs');
const path = require('path');
const p = path.join('/Users/cc/.openclaw/workspace/music-daw-case/src/App.tsx');
let code = fs.readFileSync(p, 'utf-8');

code = code.replace(
  'const [masterVolume, setMasterVolume] = useState<number>(() => {',
  `const [masterCompressorEnabled, setMasterCompressorEnabled] = useState(false)\n  const [masterCompressorThreshold, setMasterCompressorThreshold] = useState(-24)\n  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null)\n  const [masterVolume, setMasterVolume] = useState<number>(() => {`
);

code = code.replace(
  'const masterGain = ctx.createGain()',
  `const masterGain = ctx.createGain()\n      const compressor = ctx.createDynamicsCompressor()\n      masterCompressorRef.current = compressor`
);

code = code.replace(
  'masterGain.connect(analyser)',
  `masterGain.connect(compressor)\n      compressor.connect(analyser)`
);

code = code.replace(
  '  useEffect(() => {\n    if (masterGainRef.current) {\n      masterGainRef.current.gain.value = masterVolume\n    }\n  }, [masterVolume, masterGainRef])',
  `  useEffect(() => {\n    if (masterGainRef.current) {\n      masterGainRef.current.gain.value = masterVolume\n    }\n  }, [masterVolume, masterGainRef])\n\n  useEffect(() => {\n    if (masterCompressorRef.current) {\n      if (masterCompressorEnabled) {\n        masterCompressorRef.current.threshold.value = masterCompressorThreshold\n        masterCompressorRef.current.ratio.value = 4\n      } else {\n        masterCompressorRef.current.threshold.value = 0\n        masterCompressorRef.current.ratio.value = 1\n      }\n    }\n  }, [masterCompressorEnabled, masterCompressorThreshold])`
);

// We want to add it to data-testid="daw-state" json
code = code.replace(
  'masterVolume,',
  `masterVolume, masterCompressorEnabled, masterCompressorThreshold,`
);

// We want to add it to UI after masterVolume
code = code.replace(
  '<span className="master-volume-value">{(masterVolume * 100).toFixed(0)}%</span>\n        </label>',
  `<span className="master-volume-value">{(masterVolume * 100).toFixed(0)}%</span>\n        </label>\n        <label className="checkbox-label" style={{ marginLeft: '12px' }}>\n          <input data-testid="master-compressor-toggle" type="checkbox" checked={masterCompressorEnabled} onChange={e => setMasterCompressorEnabled(e.target.checked)} />\n          Comp\n        </label>\n        <label className="range-label" style={{ opacity: masterCompressorEnabled ? 1 : 0.5 }}>\n          Thr\n          <input data-testid="master-compressor-threshold" type="range" min="-60" max="0" value={masterCompressorThreshold} disabled={!masterCompressorEnabled} onChange={e => setMasterCompressorThreshold(Number(e.target.value))} />\n          <span className="compressor-value">{masterCompressorThreshold}dB</span>\n        </label>`
);

fs.writeFileSync(p, code);
