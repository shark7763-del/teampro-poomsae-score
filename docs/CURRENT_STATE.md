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

Experiment `E006` makes `#/training` directly usable without Supabase by defaulting to single-device scoring with 1, 3, or 5 judge modes while preserving the training TV connection flow.

Validation on 2026-08-08:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: pass, 4 files / 17 tests
- `npm run build`: pass
- `npm run evaluate`: 75/100
- `npm run test:e2e`: pass, 4 tests

## Next Suggested Experiment

Next step: deploy E006, then configure Supabase env vars and database migration for real cross-device TV sync.
