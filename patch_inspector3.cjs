const fs = require('fs');
const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf-8');

// For track
code = code.replace(
  '<div className="inspector-group" data-testid="inspector-track">',
  '<details className="inspector-group" data-testid="inspector-track" open>'
);
code = code.replace(
  '<div className="inspector-subtitle">Track</div>',
  '<summary className="inspector-subtitle" style={{cursor: "pointer"}}>Track Settings</summary>'
);

const trackEndOld = `                Delete Track
              </button>
            </div>
          </div>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}`;
const trackEndNew = `                Delete Track
              </button>
            </div>
          </details>
        ) : (
          <div className="inspector-empty" data-testid="inspector-track-empty">Select a track header to edit track name.</div>
        )}`;
code = code.replace(trackEndOld, trackEndNew);

// For clip
code = code.replace(
  '<div className="inspector-group" data-testid="inspector-clip">',
  '<details className="inspector-group" data-testid="inspector-clip" open>'
);
code = code.replace(
  '<div className="inspector-subtitle">Clip</div>',
  '<summary className="inspector-subtitle" style={{cursor: "pointer"}}>Clip Settings</summary>'
);

const clipEndOld = `              Split Clip
            </button>
          </div>
        ) : (
          <div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}`;
const clipEndNew = `              Split Clip
            </button>
          </details>
        ) : (
          <div className="inspector-empty" data-testid="inspector-clip-empty">Select a clip to edit note pitch.</div>
        )}`;
code = code.replace(clipEndOld, clipEndNew);

fs.writeFileSync(file, code);
