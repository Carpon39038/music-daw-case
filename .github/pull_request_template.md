## PR Summary

<!-- one-line summary -->

## Why

<!-- problem and user value -->

## UI Governance Intake (Required)

- IA Layer (choose one):
  - [ ] L1 Core
  - [ ] L2 Workflow
  - [ ] L3 Advanced
  - [ ] L4 Experimental/Debug
- Entry location:
  - [ ] Top bar
  - [ ] Panel/Drawer
  - [ ] Context menu
  - [ ] Hidden/Flagged
- Usage frequency:
  - [ ] High
  - [ ] Medium
  - [ ] Low

## Governance Checklist (Required)

- [ ] I did NOT add a new L3/L4 feature directly into L1 top-level surface.
- [ ] Entry budget remains within limits (see `docs/ui-governance-charter.md`).
- [ ] Core path (play/edit/export) remains usable with my UI open.
- [ ] Overlay/panel does not intercept pointer events on core controls.
- [ ] Empty/error/loading states are defined.
- [ ] Added or updated e2e guardrail tests.
- [ ] If I changed navigation/entry architecture, I added/updated ADR.

## Testing

- [ ] `pnpm run verify:preflight`
- [ ] `pnpm run test:e2e`
- [ ] `pnpm exec playwright test tests/e2e/ui-governance.spec.ts`

## Risk & Rollback

<!-- risk level + rollback plan -->
