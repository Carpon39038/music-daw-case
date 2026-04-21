const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/components/Transport.tsx');
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('checkpoints = useDAWStore')) {
  code = code.replace(
    "const playheadBeat = useDAWStore(s => s.playheadBeat)",
    "const playheadBeat = useDAWStore(s => s.playheadBeat)\n  const checkpoints = useDAWStore(s => s.checkpoints || [])\n  const restoreCheckpoint = useDAWStore(s => s.restoreCheckpoint)"
  );
}

if (!code.includes('data-testid="checkpoint-select"')) {
  code = code.replace(
    `<select
          disabled={isPlaying}
          onChange={(e) => {`,
    `<select
          disabled={isPlaying}
          onChange={(e) => {
            if (e.target.value) {
              restoreCheckpoint(e.target.value);
              e.target.value = '';
            }
          }}
          className="px-2 py-1 text-xs bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded focus:outline-none"
          defaultValue=""
          data-testid="checkpoint-select"
        >
          <option value="" disabled>Checkpoints</option>
          {checkpoints.map((cp) => (
            <option key={cp.id} value={cp.id}>{new Date(cp.timestamp).toLocaleTimeString()} - {cp.name}</option>
          ))}
        </select>
        
        <select
          disabled={isPlaying}
          onChange={(e) => {`
  );
}

fs.writeFileSync(file, code);
