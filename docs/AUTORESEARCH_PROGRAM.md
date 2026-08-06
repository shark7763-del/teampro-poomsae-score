# TeamPro Poomsae AutoResearch Program

## Branch

Use `feat/poomsae-score-autoresearch`.

## Baseline

Before the first experiment:

1. Run `git status --short --branch`.
2. Run existing gates: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
3. Run `npm run evaluate:baseline`.
4. Append baseline to `experiments/results.tsv`.

## Experiment Loop

For each experiment:

1. Read `docs/CURRENT_STATE.md` and the latest TSV row.
2. State one measurable hypothesis.
3. Change only the smallest file set needed for that hypothesis.
4. Run focused tests first, then full gates.
5. Run `npm run evaluate`.
6. Append one row to `experiments/results.tsv`.
7. Commit keep/crash records. For discard, revert only the experiment files and keep the TSV record.
8. Update `docs/CURRENT_STATE.md` with current score, status, and next proposed experiment.

## Hard Gates

- Any scoring test failure: `discard`.
- Build failure: `crash`.
- TypeScript or lint failure: cannot `keep`.
- Security regression: cannot `keep`.
- Unknown rule source enabled by default: cannot `keep`.
- Evaluation tool modified during an experiment: invalid experiment.
