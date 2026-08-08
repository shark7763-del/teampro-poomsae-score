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

Experiment `E007` adds a Supabase snapshot polling fallback for training display updates so the TV can recover public state even when Realtime Broadcast delivery is delayed or blocked.

Validation on 2026-08-08:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: pass, 4 files / 17 tests
- `npm run build`: pass
- `npm run evaluate`: 75/100
- `npm run test:e2e`: pass, 4 tests

## Next Suggested Experiment

Next step: verify phone-to-TV sync on two physical devices using the production URL and keep the Supabase SQL migration applied in the project.
