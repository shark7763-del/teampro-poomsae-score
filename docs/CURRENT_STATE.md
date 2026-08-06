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

Experiment `E001` adds AutoResearch process documents, official rule source documents, versioned WT and USATKD recognized poomsae Rule Profiles, integer-based pure scoring engine, and fixed evaluation harness.

## Next Suggested Experiment

Add the poomsae room event model, then test duplicate submit, locked score rejection, and refresh/reconnect replay behavior.
