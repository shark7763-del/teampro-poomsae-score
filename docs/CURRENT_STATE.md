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

Experiment `E004` removes old sparring UI/code from this repository and leaves a focused standalone poomsae system. The current app routes are `#/control`, `#/control/:roomCode`, `#/judge/:roomCode/:slot`, `#/display/:roomCode`, and `#/training`.

Validation on 2026-08-06:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: pass, 2 files / 7 tests
- `npm run build`: pass
- `npm run evaluate`: 75/100

## Next Suggested Experiment

Next step: add a real cloud Realtime Transport adapter for cross-phone use while preserving the same event envelope, judge privacy, duplicate-event protection, and sequence checks.
