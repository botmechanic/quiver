# Arc Canteen Updates

Paste these into `arc-canteen update product` or `arc-canteen update traction`. Each block intentionally has no blank lines, because the CLI ends multiline input on the first empty line.

## Product Update

```text
- Reframed Quiver around the core primitive: a per-second x402 settlement rail on Arc, composed from one EIP-3009 authorization per tick and batched by Circle Gateway.
- Archer and Scout remain the agent demo: Archer dynamically prices signals, Scout buys or declines per call, and the dashboard records the resulting payments and reasons.
- Added honest Stage 0 creator positioning: the same per-second core is designed to sit behind live-streaming servers like Owncast, turning viewer-seconds into direct creator payout.
- No Owncast sidecar is claimed yet; current shipped proof is the Archer/Scout rail, the /try real-settlement demo, and the live tap-to-stop stream meter.
```

## Traction Update

```text
- Quiver now tells one story for judges and outreach: stream money by the second, with agents as the autonomous demo and creators as the target community surface.
- The public /try path still produces honestly labeled demo-funded x402 settlements, while Scout payments and stream ticks stay separated in dashboard metrics.
- The next traction push can point people at /try and /dashboard while naming Owncast as the community deployment target without overstating a shipped adapter.
```

## Stage 1 Owncast Verified Update

```text
- Verified the Owncast Stage 1 path locally against Owncast 0.2.5: CHAT starts Quiver's existing per-second x402 stream, USER_PARTED closes it, and GET /api/integrations/clients heartbeat stops billing if USER_PARTED is not delivered to the sidecar.
- The sidecar reused the shipped rail unchanged: per-tick EIP-3009 auths, Circle Gateway batching, and stream_events as the verified billing ledger.
- Proof session 25418b23-4f15-4146-aad8-3038320a011e wrote a verified 0.0001 USDC stream tick with Owncast metadata; heartbeat-only proof session bc3fa644-031f-4bfa-89d1-7c4849aad1fb stopped via Owncast heartbeat missing and also wrote a verified tick.
```
