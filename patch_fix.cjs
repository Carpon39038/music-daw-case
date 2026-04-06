const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src/App.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const oldDelayCheckbox = `                      onChange={(e) => {
                        pushHistory()
                        setProject((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, delayEnabled: e.target.checked } : t
                          ),
                        }))
                      }}`;

const newDelayCheckbox = `                      onChange={(e) => {
                        applyProjectUpdate((prev) => ({
                          ...prev,
                          tracks: prev.tracks.map((t) =>
                            t.id === track.id ? { ...t, delayEnabled: e.target.checked } : t
                          ),
                        }))
                      }}`;

const oldDelayTime = `                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setProject((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayTime: val } : t
                            ),
                          }))
                        }}`;

const newDelayTime = `                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayTime: val } : t
                            ),
                          }))
                        }}`;

const oldDelayFb = `                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setProject((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayFeedback: val } : t
                            ),
                          }))
                        }}`;

const newDelayFb = `                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          applyProjectUpdate((prev) => ({
                            ...prev,
                            tracks: prev.tracks.map((t) =>
                              t.id === track.id ? { ...t, delayFeedback: val } : t
                            ),
                          }))
                        }}`;

content = content.replace(oldDelayCheckbox, newDelayCheckbox);
content = content.replace(oldDelayTime, newDelayTime);
content = content.replace(oldDelayFb, newDelayFb);

fs.writeFileSync(targetFile, content);
console.log('Fixed pushHistory');
