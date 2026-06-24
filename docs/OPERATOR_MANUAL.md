# Quiver Operator Manual

This manual is the practical source of truth for operating, demoing, and explaining Quiver after the Stage 1 Owncast shift.

## Current Direction

Quiver is a per-second x402 settlement rail on Arc.

The product now has two surfaces:

- **Agents:** Archer sells priced signals; Scout decides whether to buy. This is the autonomous agent demo.
- **Creators:** an Owncast sidecar drives the same per-second rail from chat-active streaming presence. This is the creator-stack adapter.

The headline is no longer "two agents trade signals." The headline is "stream money by the second." Archer and Scout prove the primitive in an agent setting; Owncast proves the primitive can attach to a real OSS creator stack.

## What Is Verified

### Core Rail

Verified and shipped:

- x402-protected Archer endpoints.
- Dynamic Archer pricing with human-readable reasons.
- Scout buy/decline decisions against quoted price, confidence, and remaining budget.
- Demo-funded `/try` path that produces real testnet x402 settlement.
- Pay-per-second stream ticks through `GET /api/archer/stream`.
- `stream_events` as the source of truth for verified stream ticks.
- Dashboard meter with tap-to-stop and exact-cost reconciliation.

### Owncast Stage 1

Verified locally against Owncast `0.2.5`:

- `CHAT` fired with server timestamp, stable `eventData.user.id`, and, in observed payloads, `eventData.clientId`.
- `USER_PARTED` fired after websocket close with the same stable `eventData.user.id`.
- `USER_JOINED` was not observed in the programmatic replay, even after enabling join messages.
- `GET /api/integrations/clients` returned the connected chat client while open and `[]` after close.
- The sidecar settled real x402 stream ticks and wrote canonical `stream_events` rows.

Proof sessions:

- Clean-close proof: `25418b23-4f15-4146-aad8-3038320a011e`
- Heartbeat-fallback proof: `bc3fa644-031f-4bfa-89d1-7c4849aad1fb`

The safe model is:

```text
Owncast CHAT or USER_JOINED -> start Quiver stream
Quiver stream -> one x402 authorization per tick
USER_PARTED -> clean close
Connected-client heartbeat missing -> fallback close
stream_events -> billing source of truth
```

## Claim Boundaries

Use this wording:

- "Quiver is a per-second x402 settlement rail on Arc."
- "Archer and Scout are the agent demo of the rail."
- "The Owncast sidecar is verified locally against Owncast 0.2.5."
- "Chat presence opens an x402 stream; USER_PARTED or connected-client heartbeat closes it."
- "stream_events is the verified ledger for paid ticks."

Avoid this wording:

- "All viewers pay by presence." Silent viewers do not trigger the verified model.
- "USER_JOINED starts the stream" as a blanket claim. It was not observed locally.
- "Owncast viewer-seconds" unless the sentence is clearly about a future or target model.
- "Production Owncast deployment" unless the sidecar is running on a public Owncast instance.
- "Mainnet" or "real money." This is Arc testnet USDC.
- "Settled volume is live." The UI surfaces authorized/verified volume; batch settlement can lag.

## System Overview

### Payment Flow

```text
Client or sidecar
  -> paid request to /api/archer/stream
  -> withGateway issues HTTP 402
  -> GatewayClient signs EIP-3009 authorization
  -> Circle Gateway verifies and settles
  -> payment_events row is inserted
  -> stream_events row is inserted for stream ticks
  -> dashboard/proof surfaces read Supabase
```

Important files:

- `app/api/archer/stream/route.ts`: x402-protected stream endpoint.
- `lib/x402.ts`: Gateway verification, settlement, and payment/stream event recording.
- `lib/stream/headers.ts`: stream and Owncast metadata headers.
- `lib/scout/stream.ts`: reusable standalone stream payer.
- `scripts/owncast-sidecar.mts`: Owncast webhook/heartbeat adapter.
- `lib/owncast/registry.ts`: single-streamer demo registry stub.
- `supabase/migrations/20260318100000_create_stream_events.sql`: stream tick ledger.

### Source Of Truth

For stream billing, `stream_events` wins.

Do not derive final tick counts from:

- client counters
- `demo_stream_sessions.tick_count`
- in-memory session maps
- local sidecar state
- `/stop` snapshots unless reconciled to `stream_events`

Use `verifiedStreamTickCount(sessionId)` or direct `stream_events` queries for user-facing totals.

## Operating The Owncast Sidecar

### Required Environment

```bash
BUYER_PRIVATE_KEY=...
SELLER_ADDRESS=...
BASE_URL=http://localhost:3000
OWNCAST_URL=http://localhost:8080
OWNCAST_ACCESS_TOKEN=...
```

Optional useful caps for demos:

```bash
OWNCAST_MAX_TICKS=10
OWNCAST_MAX_SPEND_USDC=0.001
OWNCAST_TICK_INTERVAL_MS=1000
OWNCAST_HEARTBEAT_MS=1000
OWNCAST_START_ON_CHAT=true
```

### Local Owncast

Start Owncast:

```bash
docker run -d --name owncast -p 8080:8080 -p 1935:1935 owncast/owncast
```

Admin:

```text
http://localhost:8080/admin
username: admin
password: abc123
```

Create an Owncast access token with `HAS_ADMIN_ACCESS`. The heartbeat endpoint needs this:

```text
GET /api/integrations/clients
```

### Register Webhooks

When Owncast runs in Docker on macOS and the sidecar runs on the host:

```text
http://host.docker.internal:8787/webhooks/incoming
```

Events to include:

- `CHAT`
- `USER_JOINED`
- `USER_PARTED`

`CHAT` is the verified start event. Keep `USER_JOINED` subscribed because other Owncast deployments may emit it, but do not rely on it.

### Run Quiver And Sidecar

Start Quiver:

```bash
npm run dev
```

Start sidecar:

```bash
OWNCAST_URL=http://localhost:8080 \
OWNCAST_ACCESS_TOKEN=<token> \
BASE_URL=http://localhost:3000 \
npm run owncast:sidecar
```

Open `http://localhost:8080`, join chat, and send a message. The sidecar should:

- start a stream session
- fund/deposit a session wallet
- pay `GET /api/archer/stream`
- write a `stream_events` row
- stop on `USER_PARTED` or heartbeat disappearance

## Verification Runbooks

### Claim Drift Check

Before submitting or posting public copy, search for overclaims:

```bash
rg "reliably|reliable|viewer presence|runs as an Owncast sidecar|pending replay"
```

Expected result: no matches, unless the wording is deliberately scoped.

### ProofStrip Anon Read

The logged-out landing proof strip depends on anonymous `SELECT` access to `payment_events`.

Check with the publishable key:

```bash
node --experimental-transform-types --no-warnings --env-file=.env.local --input-type=module - <<'JS'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const endpoint = `${url}/rest/v1/payment_events?select=id,raw,created_at&order=created_at.desc&limit=3`;
const res = await fetch(endpoint, { headers: { apikey: key, authorization: `Bearer ${key}` }});
console.log(res.status);
console.log(await res.text());
JS
```

Expected:

- HTTP `200`
- non-empty rows

This checks initial page load. It does not separately prove anon realtime subscriptions.

### Stream Schema

```bash
npm run verify:stream-schema
```

Expected:

- `demo_stream_sessions` exists
- `stream_events` exists
- no duplicate `(session_id, tick_number)` rows

### Lint

```bash
npm run lint
```

Known current warning:

- `lib/og-image.tsx` uses `<img>`.

## Submission Artifacts

Important docs:

- `docs/ARC_OSS_ANSWER.md`: answer for the Arc OSS showcase.
- `docs/ARC_CANTEEN_UPDATES.md`: paste-safe update blocks for `arc-canteen`.
- `docs/OWNCAST_STAGE_1.md`: verification details and proof sessions.
- `docs/PRD.md`: product strategy and source-of-truth positioning.
- `docs/ROADMAP.md`: schedule and remaining tasks.

For `arc-canteen update product`, prefix the OSS update with `ArcOSS:` when submitting to the OSS showcase.

When drafting `arc-canteen` text, do not include blank lines inside the pasted update. The CLI ends multiline input on an empty line.

## Demo Sequencing

Lead with the strongest proof:

1. Per-second stream meter: start, let ticks land, stop, show exact-cost invariant.
2. Owncast sidecar: chat message starts a stream tick, `stream_events` records Owncast metadata.
3. Archer and Scout: show autonomous pricing and buy/decline decisions.
4. ProofStrip/dashboard: show demo, Scout, and stream metrics separated.
5. Obol validation: show external buyer proof if time remains.

Keep the story simple:

```text
One rail, two surfaces:
Archer/Scout proves autonomous agent commerce.
Owncast proves the same rail can attach to a creator stack.
Both settle per second over x402 on Arc.
```

## Remaining High-Value Work

- Capture a public Owncast demo, ideally on a droplet, after local behavior is stable.
- Record a short demo video with the per-second stream first.
- Keep README and landing claims aligned with deployed reality.
- Continue reporting demo buys, Scout payments, and stream ticks separately.
- Do not count demo-funded `/try` clicks as distinct paying users.
