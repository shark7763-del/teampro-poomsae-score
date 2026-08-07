# Current State

## Baseline

- Repository: `D:\TeamPro Poomsae Score`
- Branch: `main`
- Source baseline: copied from `D:\TeamPro跆拳道簡易計分系統` commit `448ff64`
- Starting poomsae experiment commit in source repo: `af293db`
- Existing gates before poomsae work:
  - `npm run typecheck`: pass
  - `npm run lint`: pass
  - `npm run test`: 212 passed
  - `npm run build`: pass

## Current Experiment

Experiment `E005` fixes a deployment-path bug in the PWA favicon/logo reference. The current app routes are `#/control`, `#/control/:roomCode`, `#/judge/:roomCode/:slot`, `#/display/:roomCode`, `#/training`, `#/training-display`, `#/training-display/:displayCode`, `#/training/session/:sessionId`, and `#/training/connect/:displayCode`.

Validation on 2026-08-08:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: pass, 4 files / 16 tests
- `npm run build`: pass
- `npm run evaluate`: 75/100
- `npm run test:e2e`: pass, 4 tests

## Next Suggested Experiment

Next step: add Supabase-backed integration verification for training-display snapshots and Presence once a real project URL, anon key, and migration-applied database are available.
