const fs = require('fs');
const file = '/Users/cc/.openclaw/workspace/music-daw-case/src/App.tsx';
let code = fs.readFileSync(file, 'utf8');

const deleteClipCode = `
  const deleteClip = (trackId: string, clipId: string) => {
    if (isPlaying) return
    applyProjectUpdate((prev) => {
      return {
        ...prev,
        tracks: prev.tracks.map((t) => {
          if (t.id === trackId && !t.locked) {
            return {
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            }
          }
          return t
        }),
      }
    })
    setSelectedClipRef(null)
  }

  const copyClip =`;

code = code.replace('  const copyClip =', deleteClipCode);

const keydownCode = `      if (event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (selectedTrackId) {
          event.preventDefault()
          pasteClip(selectedTrackId)
        }
        return
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (selectedClipRef) {
          const track = project.tracks.find((t) => t.id === selectedClipRef.trackId)
          if (track && !track.locked && !isPlaying) {
            event.preventDefault()
            deleteClip(selectedClipRef.trackId, selectedClipRef.clipId)
          }
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)`;

code = code.replace(`      if (event.key.toLowerCase() === 'v' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (selectedTrackId) {
          event.preventDefault()
          pasteClip(selectedTrackId)
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)`, keydownCode);

const btnCode = `            <button
              data-testid="selected-clip-delete-btn"
              onClick={() => deleteClip(selectedClipData.track.id, selectedClipData.clip.id)}
              disabled={isPlaying || selectedClipData.track.locked}
            >
              Delete Clip
            </button>
            <button
              data-testid="selected-clip-copy-btn"`;

code = code.replace(`            <button
              data-testid="selected-clip-copy-btn"`, btnCode);

// Add deleteClip to useEffect dependencies
code = code.replace(`[copyClip, isPlaying, pasteClip, project.tracks, selectedClipRef, selectedTrackId, startPlayback, stopPlayback]`, `[copyClip, deleteClip, isPlaying, pasteClip, project.tracks, selectedClipRef, selectedTrackId, startPlayback, stopPlayback]`);


fs.writeFileSync(file, code);
