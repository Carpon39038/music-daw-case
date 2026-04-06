const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// The block to extract starts from:
// <details className="track-effects-details" style={{ width: '100%', marginTop: '4px' }}>
// down to:
// </details>
// inside track mapping.

const startToken = '<details className="track-effects-details" style={{ width: \'100%\', marginTop: \'4px\' }}>';
const endToken = '</details>';

let parts = content.split(startToken);
if (parts.length > 1) {
  let postStart = parts[1];
  let postParts = postStart.split(endToken);
  let effectsBlock = postParts[0];
  let afterEffects = postParts.slice(1).join(endToken);
  
  // Now we need to modify effectsBlock to use selectedTrack instead of track
  effectsBlock = effectsBlock.replace(/track\.id/g, 'selectedTrack.id');
  effectsBlock = effectsBlock.replace(/track\./g, 'selectedTrack.');
  effectsBlock = effectsBlock.replace(/setTrackPan\(track.id/g, 'setTrackPan(selectedTrack.id');
  effectsBlock = effectsBlock.replace(/setTrackTranspose\(track.id/g, 'setTrackTranspose(selectedTrack.id');
  effectsBlock = effectsBlock.replace(/setTrackFilterType\(track.id/g, 'setTrackFilterType(selectedTrack.id');
  effectsBlock = effectsBlock.replace(/setTrackFilterCutoff\(track.id/g, 'setTrackFilterCutoff(selectedTrack.id');
  // the display block has: `style={{ display: selectedTrackId === track.id ? "block" : "none" }}`
  // we can remove that or simplify it to "block"
  effectsBlock = effectsBlock.replace(/style={{ display: selectedTrackId === selectedTrack\.id \? "block" : "none" }}/g, '');

  content = parts[0] + afterEffects;

  // Now inject into Inspector
  const inspectorInsertionPoint = '            <div className="inspector-row" style={{ marginTop: \'12px\', gap: \'8px\', display: \'flex\' }}>';
  
  // We need to wrap it so it gets the track.
  let newEffectsBlock = `
            <details className="inspector-group" data-testid="inspector-track-effects" open>
              <summary className="inspector-subtitle" style={{cursor: "pointer"}}>Track Effects</summary>
              {(() => {
                const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
                if (!selectedTrack) return null;
                return (
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    ${effectsBlock.substring(effectsBlock.indexOf('<div style={{ padding: \'8px\''))}
                );
              })()}
            </details>
  `;
  
  // the substring above is because the original block starts with <summary>Parameters & Effects</summary>
  // Let's do it cleaner.
  const regex = /<summary.*?>.*?<\/summary>\s*<div style={{ padding: '8px', background: 'rgba\(0,0,0,0\.2\)', borderRadius: '4px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>([\s\S]*)/;
  const match = effectsBlock.match(regex);
  if (match) {
    let innerContent = match[1];
    // innerContent still has a closing </div> which we need to keep.
    
    let toInject = `
            <details className="inspector-group" data-testid="inspector-track-effects" open>
              <summary className="inspector-subtitle" style={{cursor: "pointer"}}>Track Effects & Params</summary>
              {(() => {
                const selectedTrack = project.tracks.find(t => t.id === selectedTrackId);
                if (!selectedTrack) return null;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    ${innerContent}
                );
              })()}
            </details>
`;

    let contentParts = content.split(inspectorInsertionPoint);
    content = contentParts[0] + toInject + inspectorInsertionPoint + contentParts[1];
    fs.writeFileSync('src/App.tsx', content);
    console.log("Refactoring applied");
  } else {
    console.log("Regex not matched");
  }
} else {
  console.log("start token not found");
}
