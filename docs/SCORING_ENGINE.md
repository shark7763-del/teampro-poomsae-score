# Scoring Engine

Poomsae scoring lives in pure functions under `src/poomsae/`. UI components must submit judge inputs and display computed results; they must not calculate final scores.

Scores are stored in tenths: `10.0` -> `100`, `4.0` -> `40`, `0.3` -> `3`, `0.1` -> `1`.

For recognized poomsae, each judge's accuracy starts at profile `accuracyMax`, then minor and major mistakes are deducted. Accuracy is clamped at zero. Presentation is the sum of configured components and is clamped to `presentationMax`.

For five judges, accuracy removes one highest and one lowest accuracy score, and presentation independently removes one highest and one lowest presentation score. Only one item is removed for tied highest or tied lowest values. For three judges, no trimming is applied.

Procedure deductions are subtracted after averaged accuracy and presentation. Tie-break returns structured states; the system never randomly resolves ties.
