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

Experiment `E003` adds LocalDemo room workflow pages: `#/control`, `#/control/:roomCode`, `#/judge/:roomCode/:slot`, and `#/display/:roomCode`. It supports same-browser multi-tab control, judge submission, score locking, publication, judge return/audit log, duplicate event protection, and stale sequence rejection.

## Next Suggested Experiment

Next step: replace LocalDemoTransport with the existing Supabase Realtime transport adapter while preserving the same event envelope and privacy rules.
