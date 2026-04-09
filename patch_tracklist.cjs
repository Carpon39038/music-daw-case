const fs = require('fs');
let code = fs.readFileSync('src/components/TrackList.tsx', 'utf-8');

code = code.replace(
  "type TrackListPanelProps = Pick<DAWActions, 'project' | 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'addTrack' | 'moveTrack' | 'duplicateTrack' | 'deleteTrack'>",
  "type TrackListPanelProps = Pick<DAWActions, 'project' | 'selectedTrackId' | 'isPlaying' | 'setSelectedTrackId' | 'toggleTrackMute' | 'toggleTrackSolo' | 'toggleTrackLock' | 'addClip' | 'setTrackVolume' | 'addTrack' | 'addDrumTrack' | 'moveTrack' | 'duplicateTrack' | 'deleteTrack'>"
);

code = code.replace(
  "export function TrackListPanel({ project, addTrack, ...rest }: TrackListPanelProps) {",
  "export function TrackListPanel({ project, addTrack, addDrumTrack, ...rest }: TrackListPanelProps) {"
);

const buttons = `<button
          data-testid="add-drum-track-btn"
          onClick={addDrumTrack}
          disabled={rest.isPlaying}
          className="add-track-btn text-gray-500 hover:text-emerald-400 p-1"
          title="Add Drum Track"
        >
          <span className="text-xs font-bold font-mono">+ DRUM</span>
        </button>
        <button
          data-testid="add-track-btn"`;
          
code = code.replace('<button\n          data-testid="add-track-btn"', buttons);

fs.writeFileSync('src/components/TrackList.tsx', code);
console.log('patched tracklist');
