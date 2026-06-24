# Quiver — Product Requirements Document

> **Status:** Draft v1 · Lepton Agents Hackathon (Canteen × Circle) · June 15–29, 2026  
> **Implementation (Jun 22):** v0 deployed · dynamic pricing · Scout buy/decline · `/try` demo path · **streaming loop + dashboard meter shipped** · partial stream hardening shipped (timeouts, fail-closed UI, verified-count reconciliation)  
> **Schedule:** see `docs/ROADMAP.md`
> **One-liner:** Quiver is a per-second x402 settlement rail on Arc. Archer↔Scout is the agent demo of it; an Owncast sidecar is the creator-stack deployment of the same rail.

---

## 1. Context & Goal

Quiver is a submission for the **Lepton Agents Hackathon** (Canteen × Circle), a two-week online builder series (June 15–29, 2026) focused on **nanopayments**: AI agents that pay, receive, and stream value at sub-cent scale, settling on **Arc** (Circle's stablecoin-native L1) via the **x402** protocol and **Circle Gateway** batched settlement.

**Judging axes (design every decision against these):**
- **Agentic sophistication — 30%.** How much the AI genuinely *decides*. Full autonomy > meaningful agency > AI-flavored automation.
- **Traction — 30%.** Real users, real payments, real volume *during the event window*. The submission form asks for these numbers directly.
- **Circle tool usage — 20%.** x402, Gateway, Circle Wallets, Arc.
- **Innovation — 20%.** Novelty versus what already exists.

This round leans toward **RFB 6 (Creator & Publisher Monetization)**.

**Primary goal:** Win or place by occupying the one axis no prior-cohort winner did — streaming — while matching the proven baseline (verifiable output, economic accountability, clean on-chain stats) that the previous (Agora) cohort rewarded.

**Non-goals:** Mainnet deployment. A production trading product. Out-trading efficient markets. Heavyweight cryptographic verification (Merkle-DAG/Irys-style) — explicitly out of scope for the two-week window.

---

## 2. Competitive Landscape (why the scope is what it is)

The prior Agora cohort results (published June 16, 2026) revealed three winning clusters, **all of which Quiver overlaps** — so concept alone is not a differentiator:

- **Reasoning as the product** (Mimir 1st, OpenMind, ReasoningReceipt) — verifiable reasoning, settled on-chain. **Now table stakes, not a headline.**
- **Agents funding their own signals** (Drip, Funding Farmer) — close to Quiver's "earn and spend" core. **Contested lane.**
- **Agent-to-agent commerce** (ArkAge: agents hire/pay/judge each other; Forum: covenant accounts). **Also contested.**
- Recurring judged value: **adversarial robustness.**

**The white space:** **pay-per-second streaming over x402** appears in none of the winning projects or the organizer's named themes. The Lepton brief independently flags streaming as a real code gap. This is Quiver's anchor. Reference implementation (`circlefin/arc-nanopayments`) and the leading comparable (ReasoningReceipt, `github.com/tang-vu/reasoning-receipt`) both ship only **discrete** per-call payments — no streaming.

**Strategic consequence:** Frame Quiver as *the streaming nanopayments project*, with trade-signal agents as the first demo surface — not as a trade-signal agent that happens to stream. Stage 1 Owncast positioning is now verified locally against Owncast `0.2.5`: `CHAT` starts per-second x402 ticks, `USER_PARTED` closes the session, and connected-client heartbeat checks guard missed/delayed close events.

---

## 3. Users

- **Archer (seller agent)** — produces trading-signal hunches, sells them over x402, prices itself dynamically, and ships a verifiable reasoning trace with each signal.
- **Scout (buyer agent)** — operates on a daily budget; reads each signal's reasoning and decides, per call, whether it is worth the quoted price.
- **Human consumers** — hackathon peers and the builder's existing community (ATC / Skool members). **Hybrid traction path (shipped):** `/try` triggers a **demo-funded** real settlement (no wallet required), clearly labeled and recorded separately from distinct payers. Option B (visitor pays with own wallet) is a stretch only if streaming lands with time to spare.
- **Creators / streamers** — Owncast sidecar surface. Quiver's per-second core runs from real Owncast chat presence: `CHAT` starts a session, `USER_PARTED` stops it, and `GET /api/integrations/clients` provides heartbeat fallback. Do not claim a pure `USER_JOINED` / `USER_PARTED` model for Owncast `0.2.5`; `USER_JOINED` was not observed in local replay.
- **Judges** — evaluate via a deployed link, README, and a <3-minute demo video without the builder present.

---

## 4. Core Features

### 4.1 Archer — the selling agent (discrete endpoints)
x402-protected endpoints that sell Archer's output per call, settling sub-cent on Arc via Gateway:
- `signal` — latest strategy signal (~$0.001)
- `market-state` — market snapshot (~$0.0001)
- `compute` (POST) — on-demand deeper analysis (priced higher; see dynamic pricing)

Each endpoint returns the result **plus a verifiable reasoning trace** (see 4.4). Maps onto the starter's `/api/premium/quote | dataset | compute` routes, reskinned.

### 4.2 Dynamic pricing (agentic 30%) — **shipped**
Archer sets price per request as a genuine decision, on two axes:
- **Compute-pegged** — more expensive-to-serve requests cost more (a heavy `compute` call > a cached `signal` lookup). **Lead with this in demo/README** — it's the most legible "the agent decides the price" story.
- **Confidence-pegged** — raise signal price when Archer's rolling edge/confidence is strong.

Inject the computed price into the `PAYMENT-REQUIRED` (HTTP 402) header. Log every price with a human-readable reason string (`lib/archer/pricing.ts`). Expose `price_reason` and `confidence` in `extensions.quiver` on the 402 payload.

### 4.3 Scout — the buying agent (agentic 30%) — **shipped**
Buyer on a daily USDC budget. Extends the starter's `agent.mts` `--limit` cap into **per-call cost-benefit logic**: given Archer's quoted 402 price and the signal's stated confidence (from the trace), decide whether to buy. Budget is config/state — **not** an ERC-4626 vault (cuttable scope). A visible **Scout declines a low-confidence signal** moment is half the demo (borrows the credibility move of publicly rejecting low-quality output).

**Decision rule (shipped):** buy when confidence ≥ 0.45 and price ≤ confidence × remaining funder budget; else decline with logged reason (`lib/scout/decision.ts`).

**Budget model:** the starter uses a persistent funded **funder wallet** that seeds fresh ephemeral payer wallets for each agent run. Scout's daily budget should live at the funder/treasury level (cumulative draws from the funder), while ephemeral wallets are disposable execution accounts for paying individual sessions.

### 4.3.1 Human demo path — Try Quiver (traction 30%) — **shipped**

Visitors at **`/try`** cannot sign EIP-3009 authorizations. The demo path is **honestly labeled**:

- **`POST /api/demo/buy`** runs funder → ephemeral → Gateway → Archer server-side (same flow as Scout).
- Produces a **real** x402 settlement visible on the dashboard.
- Recorded as `payment_events.raw.source = 'demo'` — **not** a distinct paying visitor.
- Rate-limited per IP (`DEMO_RATE_LIMIT_SECONDS`, default 30s) — mandatory; public button spends real testnet USDC from the funder. Current guardrail is in-memory/per-instance and acceptable for the testnet demo, not production abuse prevention.
- **Traction reporting:** "N demo buys" and "M Scout payments" are separate, defensible metrics.

**Out of scope for this block:** wallet-connect / visitor-funded payments (Option B) — stretch only after streaming if time allows.

### 4.4 Verifiable reasoning trace (innovation baseline — keep simple)
Each signal ships with the decision, a confidence score, the factors behind it, and a **SHA-256 hash of the canonicalized trace** in the response. The buyer can recompute the hash to confirm the reasoning is unaltered. **Do not** build the Merkle-root / decentralized-storage apparatus — the hash-you-can-check is enough to tell the "verifiable why" story. Optional onchain hash anchoring only if streaming + traction are already solid (day 11 upside).

### 4.5 Pay-per-second streaming (THE HEADLINE — innovation 20%)
There is **no native "approve a rate" primitive**; streaming is composed from **discrete per-tick EIP-3009 authorizations** that Gateway batches.
- **Tick interval:** 1 second (matches the "per second" framing; sub-500ms Gateway verification fits inside the tick).
- **Loop:** `startStream` opens a session and begins a per-second ticker on Scout's side. Each tick signs one EIP-3009 `TransferWithAuthorization` for that tick's price (e.g. ~$0.0001/sec for the live decision feed) against the `GatewayWalletBatched` domain, reusing the same `GatewayClient.pay()` path as discrete endpoints. Archer verifies instantly and releases that tick's slice of the live decision feed.
- **Gateway validity window:** Circle Gateway rejects short authorization windows (`authorization_validity_too_short`); current working starter uses `maxTimeoutSeconds = 604900` (7 days plus buffer). The stream's 1-second cadence is therefore **how often Scout signs a fresh authorization**, not a 1-second authorization expiry. **Confirmed (Jun 18):** Gateway accepts many overlapping long-validity per-tick authorizations from one funded ephemeral wallet at ~1 Hz (`scripts/spike-overlapping-auth.mts` — GREEN).
- **Ephemeral payer model:** streaming should use **one ephemeral wallet per stream session**, funded once from Scout's persistent funder, then many per-tick authorizations from that same session wallet. Creating a new ephemeral wallet per tick would add fatal gas/USDC transfer overhead and obscure the exact-cost invariant.
- **Tap-to-stop:** Stopping clears the ticker — no further authorization is signed, Archer sees no valid auth for the interval, session closes. **Invariant: the buyer pays for exactly the ticks consumed, never more.**
- **Settlement decoupling:** Instant verification (sub-500ms) is decoupled from batched onchain settlement; the stream feels live even though settlement lags. Surface **authorized/verified** volume in the UI, not settled volume.

### 4.6 Agent-to-agent loop (vehicle, not headline)
One Archer instance sells; one Scout instance buys on a budget; both settle sub-cent on Arc with no human in the loop. Makes the demo write itself: two agents settling a fraction of a cent in <0.5s.

### 4.7 Live dashboard — **partial (streaming meter shipped)**
Real-time view of money moving. Counters proven to resonate in this ecosystem: **total payments, total volume (USDC), distinct paying clients, average transaction size (target sub-cent).** Plus the live streaming meter (cumulative authorized total ticking up, rate readout, session duration). Powered by Supabase real-time subscriptions over `stream_events` and `payment_events`.

**Shipped:** payments table with realtime inserts; **demo vs Scout vs stream split** in dashboard metrics (`payment_events.raw.source`); source badges per row; Scout buy/decline panel; **live stream meter** on `/dashboard` (authorized/verified volume, tap-to-stop, exact-cost invariant banner); partial adversarial hardening for hung ticks, fail-closed close, and verified `stream_events` tick-count reconciliation. **Not shipped:** out-of-balance mid-stream and abandoned-session zombie prevention.

---

## 5. Technical Architecture

- **Starter:** `circlefin/arc-nanopayments` (clone → reinit own git → push to own `quiver` repo; keep attribution in README). Check Lepton submission rules for any "must fork official starter" requirement before wiping git history.
- **Stack:** TypeScript throughout. **Node 22 + npm** (not Bun). **Next.js App Router** = frontend (dashboard) + backend (x402 route handlers / Gateway calls) in one app. Buyer agent is a standalone script (`agent.mts`).
- **Database:** **Cloud/remote Supabase** (Postgres + real-time). **No Docker / no local Supabase** — the cloud project serves both local dev and the Vercel deploy. Supabase real-time is **load-bearing** for the streaming meter (same channel as the payments dashboard) — do not hand-roll websockets.
- **Payments:** x402 protocol (HTTP 402 → `PAYMENT-REQUIRED` → signed retry → 200 + `PAYMENT-RESPONSE`). Circle Gateway batched settlement via EIP-3009 `TransferWithAuthorization` against `GatewayWalletBatched`; `GatewayClient.pay()` wraps the buyer-side loop. Settlement on **Arc testnet**; buyer wallet funded from the **Circle faucet**.
- **Tooling — Canteen ARC CLI (`arc-canteen`):** Required project tool. Install: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git` (binary: `~/.local/bin/arc-canteen`). **Context/docs grounding:** `arc-canteen context sync` then `arc-canteen context` / `arc-canteen context --paths` — pulls Arc + Circle docs and sample codebases into `~/.arc-canteen/context/` (reference only; do not copy into this repo). **RPC (optional, local-verify-first):** `arc-canteen rpc-url --export` or `arc-canteen shell-init` sets `$RPC`; proxy enforces a read-mostly + `eth_sendRawTransaction` allowlist — do **not** point Vercel/production settlement at Canteen RPC until a local 402→200→settle test passes and you explicitly OK the switch (production stays on `https://rpc.testnet.arc.network` until then). **Hackathon updates:** progress reaches Canteen's judging server via `arc-canteen update traction` and `arc-canteen update product` (requires `arc-canteen login` + `arc-canteen profile edit` under your identity). Also: **Circle CLI** installed and authenticated. `npm run generate-wallets` for test wallets.
- **Deploy:** **Vercel** + cloud Supabase. Official public domain: [getquiver.xyz](https://getquiver.xyz). Public demo: [getquiver.xyz/try](https://getquiver.xyz/try). `BASE_URL` in Vercel must be `https://getquiver.xyz` once DNS finishes propagating. `BUYER_PRIVATE_KEY` required in Vercel for server-side demo buys.
- **Agent reasoning:** Plain TypeScript decision functions (thin, legible — scores higher than a heavyweight framework doing simple math). The starter's LangChain.js buyer can be extended *only if* LLM-driven endpoint selection is wanted later; no separate agent SDK.

**Reuse Archer's strategy core in TS** — port the signal-generating logic; it need not be a full agent port.

---

## 6. Build Plan (14 days)

| Days | Milestone |
|------|-----------|
| **0–1 (Jun 15–16)** | Logistics: Luma register (passphrase `SITEx2224`), join Canteen + Arc Discords ("Canteen + Lepton"), install ARC + Circle CLIs. Get **unmodified** starter running on Node 22 + npm against cloud Supabase. `generate-wallets`, fund buyer from faucet, confirm stock `/api/premium/quote` does 402→200 with one settled testnet payment. **No custom code until this green-lights.** |
| **2–3 (Jun 17–18)** | Reskin seller endpoints to Archer's signals. Port strategy core to TS. **Deploy to Vercel + wire cloud Supabase. Submit v0 immediately** — a deployed payable URL is the critical milestone; everything after is score-raising. |
| **4–6 (Jun 19–21)** | ~~Dynamic pricing~~ · ~~Scout buy/decline~~ · ~~`/try` demo path~~ · **done (Jun 17)**. Submit updated v0. Traction: share `/try` link in Discord + community. |
| **7–10 (Jun 22–25)** | **Streaming layer** (widest window — highest variance). Day 7: one stream paying real per-second ticks, landing in DB. Day 8: dashboard meter + tap-to-stop with visible exact-cost invariant. Days 9–10: harden edges (failed tick, out-of-balance, clean close) — this is the **adversarial-robustness** story, pull it into the demo. **Traction push in parallel** — demo buys accumulate via `/try`; track demo vs Scout separately. |
| **11–12 (Jun 26–27)** | Wire the two-sided Archer↔Scout loop. Dashboard polish (live money-flow + streaming meter). *Optional upside only if solid:* onchain hash anchoring, ERC-8004 bonded seller, or small budget vault. |
| **13–14 (Jun 28–29)** | <3-min demo video (two agents settling a fraction of a cent in <0.5s; the per-second stream tap-to-stop). README for an unattended judge. Fill traction numbers honestly. Final submission before Jun 29 deadline. |

**Sequencing principle:** front-load a deployed payable URL (day 3); treat streaming as the widest-window risk so a slip threatens *a better submission*, never *having a submission*. Streaming and traction are independent workstreams — a bad day on one never blocks the other.

---

## 7. Brand

- **Names:** Project/dashboard **Quiver** · seller agent **Archer** · buyer agent **Scout**. (Arrows = signals; Scout "scouts" for worthwhile ones; Quiver is where they live. Keep this metaphor consistent across code, endpoints, README, and video — cheap now, costly to retrofit.)
- **Palette — "Struck Coin":** Ink Black `#0B0B0D` (bg) · Struck Gold `#D4AF37` (core) · Pale Gold `#E8C766` (highlight) · Bronze Shadow `#7A5C1E` (depth) · Bone `#EDE6D6` (text) · Signal Green `#3FB950` (**only** for live/verified states — payment verified, tick landing).
- **Logo:** Abstract geometric mark, implied arrow in negative space, flat gold on black (institutional register). SVG locked; store at `public/logo.svg` + square favicon. Typeset the wordmark in the real site font for crispness rather than relying on the generated lettering.

---

## 8. Success Metrics

- **Must-have (existence):** Deployed payable URL with one settled testnet payment (day 3). **Met.**
- **Core (partial):** ~~Working discrete x402 endpoints~~ · ~~dynamic pricing with logged reasons~~ · ~~Scout buy/decline~~ · ~~demo path (`/try`)~~ · ~~working per-second stream (loop + meter)~~ · **days 9–10 stream hardening** (not started).
- **Traction (30% — report honestly):** Report **demo buys** and **Scout payments** separately. Distinct paying clients = Scout payer addresses only. Target: beat ~19-payer / sub-dollar prior-comparable bar for real funded payers; demo buys are engagement, not distinct payers.
- **Demo:** <3-min video leading with the stream and the two-agent settlement; README a judge can follow unattended.

---

## 9. Risks & Mitigations

- **Streaming is the headline *and* the hardest part** (no native primitive). → Protect day 7 start / day 8 meter fiercely; it's de-risked by the grounded per-tick design, but it's build-not-port.
- **Every non-streaming element has prior-cohort precedent.** → Precedent = viable, not taken. Win on execution, the streaming anchor, and traction; lead the pitch with streaming.
- **Scope creep** (vault, Merkle/Irys, bonded seller, cross-chain). → All explicitly optional/late (day 11+). First things cut under pressure.
- **Traction underperforms.** → `/try` link live; demo buys bank honestly. Share in Discord + ATC/Skool immediately after deploy verification.
- **Demo funder drain.** → Per-IP rate limit (30s default); refaucet funder if needed; know IP rotation is the exposed edge.
- **DRY_RUN safety.** → Trading strategy and payment layer get **independent kill switches**; a live-payments demo must never imply live trading.
- **Judge access.** → Do **not** hand judges operator credentials if avoidable. For final submission, prefer a token-gated read-only judge route over passkeys: `JUDGE_ACCESS_TOKEN` unlocks proof-only surfaces while withdrawals, Gateway controls, demo buys, and stream start/stop remain operator-only.
- **Compliance posture.** → Public data only; signal-sharing framed as educational, not investment advice.
