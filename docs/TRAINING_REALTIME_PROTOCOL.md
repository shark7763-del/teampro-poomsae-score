# Training Realtime Protocol

Channel format:

```text
training-display:{sessionId}
```

Transport implementations:

- `LocalTrainingTransport`: BroadcastChannel for local demo only.
- `SupabaseTrainingTransport`: Supabase Realtime Broadcast, Presence, and sanitized snapshot table.

Every event includes:

- `schemaVersion`
- `eventId`
- `sessionId`
- `displayId`
- `senderId`
- `senderRole`
- `sequence`
- `sentAt`
- `type`
- `payload`

Rules:

- `eventId` is deduplicated.
- `sequence` rejects stale events.
- events for another `sessionId` are ignored.
- incompatible `schemaVersion` is ignored and should trigger an update notice in future UI.
- display clients do not publish training mutations.
- state snapshots are sanitized before they are sent or stored.

Supabase setup:

1. Apply `supabase/migrations/202608061_training_display_sync.sql`.
2. Enable Realtime Broadcast and Presence.
3. Keep Realtime private channel authorization enabled.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `VITE_*`.

The migration also creates `realtime.messages` policies for anon clients on
`training-display:%` topics. Supabase documents that private Broadcast and
Presence authorization is controlled through RLS policies on
`realtime.messages`.
