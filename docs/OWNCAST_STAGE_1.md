# Owncast Stage 1

## Verdict

Step 0 was verified against local Owncast `0.2.5` running in Docker on June 24, 2026. The clean `USER_JOINED` / `USER_PARTED` window did not hold exactly as described: `USER_PARTED` fired in the observed runs, but `USER_JOINED` did not fire in the programmatic chat replay, even after enabling join messages. `CHAT` is the verified start event because it carries `eventData.user.id` and, in observed chat payloads, may carry `eventData.clientId`; `USER_PARTED` is the verified close event because it carries the same stable `eventData.user.id`.

Evidence gathered:

| Check | Result | Impact |
| --- | --- | --- |
| Webhook registration | Owncast accepted `CHAT`, `USER_JOINED`, `USER_PARTED`, `STREAM_STARTED`, `STREAM_STOPPED`, and `STREAM_TITLE_UPDATED`. | `USER_PARTED` exists as a real webhook event in this version. |
| Chat presence start | `CHAT` fired with server timestamp, stable `user.id`, and `clientId`. `USER_JOINED` was not observed. | Start sessions on `CHAT` by default, with `USER_JOINED` supported if a deployment emits it. |
| Chat presence close | `USER_PARTED` fired after websocket close, with server timestamp and matching `user.id`. | Close sessions on `USER_PARTED` as the primary stop signal. |
| Heartbeat API | `GET /api/integrations/clients` returned the connected client while open and `[]` after close using a `HAS_ADMIN_ACCESS` token. | Heartbeat remains the fallback stop check and protects against missed/delayed part events. |

Current honest claim: Quiver has an Owncast sidecar that uses real Owncast chat presence to drive the existing per-second x402 stream rail: `CHAT`/`USER_JOINED` starts the session, `USER_PARTED` closes it, and connected-client heartbeat checks are the fallback stop condition.

Do not claim a pure `userJoined` / `userParted` window for this Owncast version. The verified model is `CHAT` start plus `USER_PARTED` close, guarded by heartbeat.

End-to-end adapter proofs:

- Clean local proof: sidecar session `25418b23-4f15-4146-aad8-3038320a011e` started from Owncast `CHAT`, verified one `0.0001` USDC x402 stream tick, wrote `owncast_user_id`, `owncast_client_id`, and `owncast_event_type` into the `stream_events` raw payload, then stopped after Owncast presence disappeared.
- Heartbeat-fallback proof: sidecar session `bc3fa644-031f-4bfa-89d1-7c4849aad1fb` was run with the sidecar webhook subscribed to `CHAT` only, so `USER_PARTED` was not delivered to the sidecar. It stopped via `Owncast heartbeat missing` and wrote one verified `0.0001` USDC x402 tick to `stream_events`.

## Local Replay Checklist

Run Owncast:

```bash
docker run -d --name quiver-owncast-stage1 -p 8080:8080 -p 1935:1935 owncast/owncast
```

Run Quiver locally in another terminal:

```bash
npm run dev
```

Run the sidecar:

```bash
OWNCAST_URL=http://localhost:8080 OWNCAST_ACCESS_TOKEN=<token> BASE_URL=http://localhost:3000 npm run owncast:sidecar
```

Register a webhook in Owncast admin:

- URL: `http://host.docker.internal:8787/webhooks/incoming` when Owncast runs in Docker on macOS.
- Events: select all events, especially `USER_JOINED`, `USER_PARTED`, `CHAT`, `STREAM_STARTED`, and `STREAM_STOPPED`.

Generate the test:

- Open `http://localhost:8080` in a second browser or incognito window.
- Join chat and send a message.
- Confirm the sidecar starts a Quiver stream.
- Close the viewer tab and wait 30-60 seconds.
- Confirm whether `USER_PARTED` arrives; regardless, confirm heartbeat polling stops the stream once the client disappears from `GET /api/integrations/clients`.

Capture:

| Question | Result |
| --- | --- |
| Does `USER_JOINED` fire? | Not observed in the programmatic replay, even after enabling join messages. |
| Does `USER_PARTED` fire? | Yes, after websocket close in the observed runs. |
| Is `eventData.clientId` stable? | Present on `CHAT`; absent on `USER_PARTED` in the observed payloads. |
| Is `eventData.user.id` stable? | Yes; it matches across `CHAT` and `USER_PARTED`. |
| Does heartbeat stop the stream? | Yes; session `bc3fa644-031f-4bfa-89d1-7c4849aad1fb` stopped via `Owncast heartbeat missing` when the sidecar did not receive `USER_PARTED`. |

## Sidecar Configuration

Required:

- `BUYER_PRIVATE_KEY`: the Quiver stream funder key.
- `SELLER_ADDRESS`: current x402 settlement recipient.
- `BASE_URL`: Quiver app URL, for example `http://localhost:3000`.
- `OWNCAST_ACCESS_TOKEN`: Owncast integration token with access to connected clients.

Optional:

- `OWNCAST_URL`: defaults to `http://localhost:8080`.
- `OWNCAST_SIDECAR_PORT`: defaults to `8787`.
- `OWNCAST_TICK_INTERVAL_MS`: defaults to `1000`.
- `OWNCAST_HEARTBEAT_MS`: defaults to `2000`.
- `OWNCAST_MAX_TICKS`: optional cap for a demo session.
- `OWNCAST_MAX_SPEND_USDC`: optional spend cap for a demo session.
- `OWNCAST_MAX_SESSION_MS`: defaults to `300000`.
- `OWNCAST_START_ON_CHAT`: defaults to `true`; set to `false` only on deployments where `USER_JOINED` is verified.
- `OWNCAST_STREAMER_ID`, `OWNCAST_STREAMER_NAME`, `OWNCAST_STREAMER_ADDRESS`: single-streamer registry stub.

## Claim Boundary

Stage 1 copy can now describe the verified Owncast presence model:

- Strong but accurate: "runs as a sidecar using Owncast chat presence: a real chat event starts per-second x402 ticks, `USER_PARTED` closes the session, and connected-client heartbeat checks guard the stop path."
- Avoid: "settles from `userJoined` / `userParted`" unless a specific Owncast deployment proves `USER_JOINED` fires.
