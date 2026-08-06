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

Experiment `E002` replaces the placeholder public page with a directly usable single-device recognized poomsae calculator. It supports WT/USATKD profile selection, 3/5 judges, accuracy deductions, presentation components, procedure deductions, trimming markers, and final score display.

## Next Suggested Experiment

Add the poomsae room event model, then test duplicate submit, locked score rejection, and refresh/reconnect replay behavior.
