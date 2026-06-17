# Quiver — Roadmap

> Companion to `docs/PRD.md`. The PRD is the **what & why**; this is the **what's-done & what's-next** schedule.
> **Event:** Lepton Agents Hackathon (Canteen × Circle) · June 15–29, 2026 · Final submission before **June 29**.
> **Headline still to build:** true pay-per-second streaming over x402 on Arc.
> **Last updated:** June 17, 2026 — update the status column when something ships or deploys.

---

## Status at a glance

| Block | Scope | Status |
|-------|-------|--------|
| 0–1 | Starter running, real 402→200, settled testnet payment | ✅ Done |
| 2–3 | Reskin to Archer endpoints, thin strategy core, hashed trace, **deployed payable v0** | ✅ Done & live |
| 4–6a | Dynamic pricing (compute + confidence) + Scout decline logic | ✅ Done & live |
| 4–6b | Honest human demo-buy path (`/try`) | ✅ Done & live |
| — | **Release `/try` + start traction outreach** | ⏳ **NEXT ACTION** |
| 7–10 | **Pay-per-second streaming (headline)** + parallel traction | ⬜ Not started |
| 11–12 | Two-sided Archer↔Scout loop + dashboard polish + optional upside | ⬜ Not started |
| 13–14 | Demo video, README/submission polish, final submit | ⬜ Not started |

Legend: ✅ done · ⏳ in flight / pending · ⬜ not started

---

## Immediate next action — Release `/try` & traction outreach

Blocks 4–6 are deployed to [quiver-self.vercel.app](https://quiver-self.vercel.app). Remaining gate before streaming: confirm live behavior and **ship the link**.

- [x] Set/confirm Vercel env vars: `BASE_URL` (**stable prod domain, not a preview URL**), `DEMO_RATE_LIMIT_SECONDS=30`, `DEMO_DEPOSIT_AMOUNT=0.01`; existing keys unchanged.
- [x] Deploy. (No migration required — source tag lives in `payment_events.raw` as `demo` / `scout`.)
- [ ] Live verify on the deployed URL:
  - [x] `/try` loads and demo buy settles (dynamic price + recomputable trace)
  - [ ] Dashboard → row tagged `demo`, demo vs scout metrics split cleanly
  - [ ] Rapid double-click `/try` → `429` cooldown (the real funder guardrail in prod)
  - [ ] Scout run → `scout`-sourced rows with dynamic prices in the 402/reason
  - [x] Confirm `/try` calls the **deployed** Archer endpoints, not localhost/preview
- [ ] **Release `https://quiver-self.vercel.app/try` in the hackathon Discord + ATC/Skool.** This *is* the traction event — every demo buy from here is a real, honestly-labeled data point.
- [ ] Submit/refresh the v0 on the hackathon form.

**Funder runway:** ~15.84 USDC ≈ ~12k demo buys. Rate limit (per-IP 30s) is the guardrail, not wallet exhaustion. Top up from the Circle faucet if balance drops below ~$1. Known soft edge: per-IP limit is defeatable by IP rotation — acceptable for a testnet demo; watch for unusually fast drain once the link is public.

---

## Days 7–10 — Pay-per-second streaming (THE HEADLINE)

The one axis no prior-cohort winner occupied. Highest variance — protect this window. Build-not-port. Grounded model already settled (see PRD §4.5 and the `STREAMING-OPEN-Q` note in `lib/x402.ts`).

**The model (decided):**
- No native "approve a rate" primitive — streaming = many discrete per-tick EIP-3009 authorizations that Gateway batches.
- **One ephemeral wallet per stream session**, funded once at session start, then many per-tick authorizations from it (per-tick wallet creation would be fatal to per-second cadence).
- 1-second tick. Sub-500ms Gateway verification fits inside the tick.
- Surface **authorized/verified** volume live, not settled (settlement batches lag).

**Open question to resolve first (day 7, before building the loop):**
- [ ] Confirm Circle Gateway accepts many overlapping long-validity authorizations from one buyer in rapid succession. This is the load-bearing unknown — test it in isolation before building the meter on top of it.

**Build sequence (so a slip never costs the feature, only its polish):**
- [ ] **Day 7:** one stream session paying real per-second ticks against Archer, landing in a `stream_events` table. Ugly is fine — the loop working is the milestone.
- [ ] **Day 8:** wire the dashboard streaming meter via Supabase real-time (same channel as payments — do **not** hand-roll websockets). Implement **tap-to-stop** with the visible invariant: *cost = seconds consumed × rate, never more*.
- [ ] **Days 9–10:** harden edges — failed tick mid-stream, buyer out of balance, clean session close. **This is the adversarial-robustness story** the prior cohort rewarded — make "the meter provably can't over-charge" visible in the demo, not just true in code.

**In parallel, all four days — traction:**
- [ ] Keep driving demo buys / Scout activity. Track: distinct paying clients, total payments, total USDC volume, avg transaction size (sub-cent). Streaming and traction are independent — a bad day on one never blocks the other.

**Exit criteria:** a working per-second stream, tap-to-stop, never-over-charge invariant demonstrable, meter live on the dashboard.

---

## Days 11–12 — Two-sided loop, polish, optional upside

- [ ] Wire the full **Archer↔Scout** loop: one instance sells, one buys on a budget, settling sub-cent on Arc with no human in the loop. (Vehicle for the demo's "two agents settle a fraction of a cent in <0.5s" moment.)
- [ ] Dashboard polish: live money-flow + streaming meter reading cleanly together; demo/scout split legible to a stranger.
- [ ] **Optional upside — only if streaming + traction are already solid:**
  - [ ] Onchain anchoring of the reasoning-trace hash (beyond the simple recomputable hash).
  - [ ] ERC-8004 bonded seller (stake that slashes on bad signals) — innovation lever, contested-but-novel.
  - [ ] Small budget vault for Scout (ERC-4626) — *first thing to cut*; do not let it pull focus.
- [ ] Stretch (only if streaming landed early): **Option B human path** — visitor pays with their own wallet (wallet-connect + Arc testnet + faucet + in-browser x402 signing). High friction; real distinct payers. Explicitly out of scope unless time is genuinely free.

---

## Days 13–14 — Demo, submission, polish

- [ ] **Demo video (<3 min):** lead with the stream (tap-to-stop, exact-cost) and the two-agent settlement (<0.5s). Trace/verifiability is supporting, not the headline — it's table stakes this cohort.
- [ ] **README:** ensure it describes only what's *live*; roadmap stays clearly forward-looking. No gap between claim and reality (the one thing that loses judge trust).
- [ ] **Traction numbers:** fill the form honestly — demo buys and real agent payments reported *separately*. Bar to beat: the comparable's ~19 payers / sub-dollar.
- [ ] **Polish (cheap, high-signal):** GitHub repo description + topics; tag a release; confirm dashboard renders for a logged-out/first-time judge; consider a cleaner domain over `quiver-self.vercel.app` (you own `VendingMachine.money`) — DNS change only, day-13 polish.
- [ ] **Final submission before the June 29 deadline.** Submit early and often — resubmission is free.

---

## Standing principles (carry through every block)

- **Ship-verify-move.** Deploy each block and confirm live before stacking the next; never enter streaming with untested blocks beneath it.
- **A deployed payable URL beats a polished local one.** Existence-proof first, score-raising second.
- **Scope discipline.** Vault / Merkle anchoring / bonded seller / cross-chain / Option B are all optional and late — first things cut under pressure.
- **Honest metrics.** Demo vs real payments stay separated. A number that survives "who actually paid?" beats a bigger number that doesn't.
- **Legible agency.** Every agent decision (price, buy/decline) logs a human-readable reason — the *decision* is what scores 30%, so it must be explainable, not a black box.
- **Safety invariants.** Independent kill switches for trading vs payments; mandatory rate limit on any public funder-spending route; testnet-only keys; public data only, signal-sharing is educational not investment advice.
- **Keep PRD + ROADMAP in sync with reality.** When deployed reality contradicts a doc, update the doc — they're the source of truth for the next session and the next prompt.
