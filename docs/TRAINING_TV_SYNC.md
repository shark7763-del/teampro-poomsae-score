# Training TV Sync

Training TV Sync adds a coach-phone controller and a separate TV display for `#/training`.

## Routes

- `#/training`: coach controller.
- `#/training/session/:sessionId`: resumed coach controller.
- `#/training-display`: TV pairing screen.
- `#/training-display/:displayCode`: TV display screen.
- `#/training/connect/:displayCode`: phone pairing entry opened from QR Code.

## Pairing

The TV creates a six-character `displayCode` using an alphabet that avoids `0/O` and `1/I/L`. The QR Code points to `#/training/connect/:displayCode?sessionId=...`.

When Supabase env vars are present, the TV creates a sanitized snapshot in `training_display_snapshots`, then coach phones use the display code to find the active session and join `training-display:{sessionId}`.

When Supabase is missing, the app falls back to `LocalTrainingTransport` and marks the UI as `本機測試`. That mode is only for same-device browser tabs.

## Supabase Setup

1. Create a Supabase project.
2. Copy Project URL and anon public key into `.env`.
3. Apply `supabase/migrations/202608061_training_display_sync.sql`.
4. In Realtime settings, keep private channel authorization enabled.
5. Deploy with the same two frontend env vars.

Do not use or expose the service role key in this app.

## Public Data

Only sanitized display state is sent to the TV. `sanitizeTrainingDisplayState` removes private coach notes and suppresses issue details unless the coach enables public issue display.

The TV never receives service role keys, email, phone, login tokens, or complete athlete history.

## Timer

The timer does not send one message per second. The controller sends `timerStartedAt`, `accumulatedSeconds`, and `timerStatus`. The TV renders local elapsed time and receives formal updates on start, pause, sync, result, and session end.

## Recovery

Important state changes publish both a realtime event and a sanitized snapshot. On refresh the display rejoins the channel, requests a snapshot, and keeps the last available screen while reconnecting.
