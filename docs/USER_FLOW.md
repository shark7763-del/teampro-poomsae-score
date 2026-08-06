# User Flow

## Roles

- Display: public TV / projector view.
- Control: score table and event operator.
- Judge: mobile judge terminal.
- Training: single-device coach practice mode.

## State Flow

```text
SETUP
WAITING_FOR_JUDGES
READY
ACCURACY_SCORING
PRESENTATION_SCORING
WAITING_FOR_SUBMISSIONS
SCORES_LOCKED
READY_TO_PUBLISH
PUBLISHED
COMPLETED
```

The state is represented as a discriminated union, not unrelated boolean flags.
