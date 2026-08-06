# Architecture

The current repository is `teampro-taekwondo-score-lite`, a React 19 + TypeScript + Vite app with Vitest, ESLint, PWA support, Supabase Realtime Broadcast, QR Code links, and HashRouter routes.

Existing reusable modules:

- `src/components/QrCode.tsx`
- `src/room/roomChannel.ts`
- `src/room/links.ts`
- `src/room/clock.ts`
- `src/lib/supabaseClient.ts`
- route approach in `src/App.tsx`

Poomsae additions:

- `src/rules/profiles/`: versioned Rule Profiles.
- `src/poomsae/`: pure scoring functions and typed workflow state.
- `src/transport/`: room event abstraction for poomsae.
- `evaluation/`: fixed AutoResearch evaluation harness.

The existing sparring engine stays intact. Poomsae scoring is separate because WT poomsae scoring is judge-evaluation based, not event-point based.
