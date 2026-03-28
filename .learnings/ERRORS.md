# Errors Log

## [ERR-20260328-001] package-json-edit-missing-comma

**Logged**: 2026-03-28T12:28:00Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
Editing package.json scripts introduced invalid JSON (missing comma before dependencies), causing npm EJSONPARSE during harness eval run.

### Error
```
npm error code EJSONPARSE
npm error JSON.parse Invalid package.json: JSONParseError: Expected ',' or '}' after property value in JSON at position 316 (line 14 column 3)
```

### Context
- Operation attempted: run `npm run harness:eval -- --task daw-harness-v01`
- Root cause: text replacement added scripts but omitted trailing comma after scripts block.

### Suggested Fix
- Validate package.json after any edit (e.g., `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('ok')"`).
- Prefer structured JSON editing for package.json changes.

### Metadata
- Reproducible: yes
- Related Files: music-daw-case/package.json

---
## [ERR-20260328-002] package-json-edit-missing-comma-recurring

**Logged**: 2026-03-28T12:35:00Z
**Priority**: high
**Status**: pending
**Area**: config

### Summary
Second recurrence of package.json missing comma after scripts block while editing npm scripts for test/e2e integration.

### Error
```
npm error code EJSONPARSE
npm error JSON.parse Invalid package.json: JSONParseError: Expected ',' or '}' after property value
```

### Context
- Operation attempted: `npm run test`
- Similar to ERR-20260328-001

### Suggested Fix
- After each package.json edit, always run JSON parse check immediately.
- Prefer deterministic JSON patch helper over manual text replacements.

### Metadata
- Reproducible: yes
- Related Files: music-daw-case/package.json
- See Also: ERR-20260328-001

---
