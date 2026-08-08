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

Experiment `E011` fixes the training penalty lamp payload so live-score TV screens show the large -0.1/-0.3 signal instead of only the mistake counters.

Validation on 2026-08-08:

- `npm run typecheck`: pass
- `npm run lint`: pass
- `npm run test`: pass, 4 files / 18 tests
- `npm run build`: pass
- `npm run evaluate`: 75/100
- `npm run test:e2e`: pass, 4 tests

## Next Suggested Experiment

Next step: have teammates use `#/tv` on the display device and `#/training` on the phone, switch to live-score mode, and confirm the large penalty lamp appears.
