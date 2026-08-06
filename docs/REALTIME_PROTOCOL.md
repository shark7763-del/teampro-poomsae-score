# Realtime Protocol

The existing TeamPro sparring system already has a stable room flow:

- Hash routes for QR-safe links.
- Six-character room code.
- QR Code join links.
- `roomChannel` abstraction over Supabase Realtime Broadcast and local BroadcastChannel fallback.
- Main control device is the authority in the current implementation.
- `clientEventId` prevents duplicate judge presses in sparring mode.
- Full state snapshots are replayed so display refresh can recover the latest official state.

Poomsae will keep the transport concept but uses a stricter event protocol.

```ts
interface RoomTransport {
  createRoom(): Promise<RoomSession>
  joinRoom(input: JoinRoomInput): Promise<RoomSession>
  publish(event: RoomEvent): Promise<void>
  subscribe(handler: (event: RoomEvent) => void): () => void
  reconnect(): Promise<void>
  leave(): Promise<void>
}
```

Every poomsae event must include `schemaVersion`, `eventId`, `roomId`, `performanceId`, `senderRole`, `judgeSlot`, `sequence`, `createdAt`, and `payload`.

Before publication, display shows only connection and submission state. Control sees submitted / missing status before publication, not per-judge scores. Service role keys and private credentials are never exposed to the frontend.
