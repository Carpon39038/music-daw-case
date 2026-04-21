const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace("import { ShortcutPanel } from './components/ShortcutPanel'", "import { ShortcutPanel } from './components/ShortcutPanel'\nimport { useEffect } from 'react'\nimport { useDAWStore } from './store/useDAWStore'\nimport { decodeSharePayload } from './utils/shareLink'");

const effectCode = `
  useEffect(() => {
    const hash = window.location.hash
    if (hash.startsWith('#share=')) {
      const base64Str = hash.slice(7)
      const payload = decodeSharePayload(base64Str)
      if (payload) {
        useDAWStore.setState({
          project: payload.project,
          masterVolume: payload.masterVolume,
          masterEQ: payload.masterEQ,
          loopEnabled: payload.loopEnabled,
          loopLengthBeats: payload.loopLengthBeats
        })
      }
      // Remove hash to keep URL clean and allow refreshing
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])
`;

code = code.replace("const daw = useDAWActions()", "const daw = useDAWActions()\n" + effectCode);

fs.writeFileSync('src/App.tsx', code);
