#!/bin/bash
cd /Users/cc/.openclaw/workspace/music-daw-case
export FORCE_COLOR=0
claude --permission-mode bypassPermissions --print "You are the music-daw-case intense dev executor. Goal: Add Track Distortion effect to the DAW.
1. Add 'distortionEnabled?: boolean' to Track interface, project type, and default track factory in src/App.tsx.
2. In the usePlayback hook of src/App.tsx, create a WaveShaperNode for distortion if enabled, and connect it in the track's audio graph (e.g., between gain and pan). You can use a simple curve for the WaveShaperNode (search MDN for makeDistortionCurve).
3. Add a simple UI toggle in the track header (near reverb/compressor) to toggle distortion, with data-testid='track-distortion-toggle-{track.id}'. Also add it to DAW state JSON for tests.
4. Write a playwright e2e test in tests/track-distortion.spec.ts that adds a track, toggles the distortion, and asserts the DAW state updates.
5. Run pnpm run verify:preflight and pnpm run test:e2e. If tests fail, fix them!
6. Run pnpm run harness:loop -- --task daily-dev-distort.
7. Commit your changes: git add . && git commit -m 'feat(daw): add track distortion effect with e2e test'. Do not push.
8. Output the final summary block: (task, status, changed_files, feature_or_fix, total_runs, pass_rate, score, failure_buckets_changed, commit, BLOCKED_BY) plus a short conclusion." > agent_out.log 2>&1
echo "DONE" >> agent_out.log
