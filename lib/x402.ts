/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  PAYMENT_SOURCE_HEADER,
  STREAM_SESSION_HEADER,
  STREAM_TICK_HEADER,
} from "@/lib/stream/headers";

export const sellerAddress = process.env.SELLER_ADDRESS as `0x${string}`;

// Arc Testnet contract addresses (from @circle-fin/x402-batching SDK)
const ARC_TESTNET_NETWORK = "eip155:5042002";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ARC_TESTNET_GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

export {
  PAYMENT_SOURCE_HEADER,
  STREAM_SESSION_HEADER,
  STREAM_TICK_HEADER,
} from "@/lib/stream/headers";

const facilitator = new BatchFacilitatorClient();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function resolvePaymentSource(req: NextRequest): "demo" | "scout" | "stream" {
  if (req.headers.get(PAYMENT_SOURCE_HEADER) === "demo") return "demo";
  if (req.headers.get(STREAM_SESSION_HEADER)) return "stream";
  return "scout";
}

async function recordStreamEvent(
  req: NextRequest,
  details: {
    endpoint: string;
    payer: string;
    amountUsdc: string;
    gatewayTx: string | null;
    raw: Record<string, unknown>;
  },
) {
  const sessionId = req.headers.get(STREAM_SESSION_HEADER);
  const tickRaw = req.headers.get(STREAM_TICK_HEADER);
  if (!sessionId || !tickRaw) return;

  const tickNumber = parseInt(tickRaw, 10);
  if (!Number.isFinite(tickNumber) || tickNumber < 1) return;

  const amount = parseFloat(details.amountUsdc);
  const cumulativeUsdc = (amount * tickNumber).toFixed(6);

  const { error } = await supabase.from("stream_events").insert({
    session_id: sessionId,
    tick_number: tickNumber,
    amount_usdc: details.amountUsdc,
    cumulative_usdc: cumulativeUsdc,
    verified_at: new Date().toISOString(),
    status: "verified",
    payer: details.payer,
    endpoint: details.endpoint,
    gateway_tx: details.gatewayTx,
    raw: details.raw,
  });

  if (error) {
    console.error("[x402] Failed to record stream event:", error.message);
  }
}

interface PaymentPayload {
  x402Version: number;
  resource?: { url: string; description: string; mimeType: string };
  accepted?: Record<string, unknown>;
  payload: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export interface GatewayQuote {
  /** Dollar string for x402, e.g. "$0.0014" */
  price: string;
  reason: string;
  priceUsdc?: string;
  confidence?: number;
}

function buildPaymentRequirements(price: string) {
  // Parse dollar amount to USDC atomic units (6 decimals)
  const amount = Math.round(parseFloat(price.replace("$", "")) * 1_000_000);

  return {
    scheme: "exact" as const,
    network: ARC_TESTNET_NETWORK,
    asset: ARC_TESTNET_USDC,
    amount: amount.toString(),
    payTo: sellerAddress,
    // STREAMING-OPEN-Q: resolved GREEN (Jun 18) — see scripts/spike-overlapping-auth.mts.
    // Streaming funds one ephemeral wallet per session, then signs many long-validity per-tick
    // authorizations from it; Gateway accepts overlapping auths at ~1 Hz.
    maxTimeoutSeconds: 604900,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: ARC_TESTNET_GATEWAY_WALLET,
    },
  };
}

function buildPaymentRequired(
  endpoint: string,
  quote: GatewayQuote,
  requirements: ReturnType<typeof buildPaymentRequirements>,
) {
  const priceLabel = quote.priceUsdc ?? quote.price.replace("$", "");
  const description = quote.confidence
    ? `Paid resource (${priceLabel} USDC) — confidence ${quote.confidence.toFixed(2)}`
    : `Paid resource (${priceLabel} USDC)`;

  const paymentRequired: Record<string, unknown> = {
    x402Version: 2,
    resource: {
      url: endpoint,
      description,
      mimeType: "application/json",
    },
    accepts: [requirements],
  };

  if (quote.reason || quote.confidence !== undefined) {
    paymentRequired.extensions = {
      quiver: {
        price_usdc: priceLabel,
        price_reason: quote.reason,
        ...(quote.confidence !== undefined
          ? { confidence: quote.confidence }
          : {}),
      },
    };
  }

  return paymentRequired;
}

/**
 * Wraps a Next.js route handler with Circle Gateway payment verification.
 *
 * `prepare` runs once per request to compute the dynamic quote before the 402
 * is issued (and again on the paid retry so verify/settle match the quote).
 */
export function withGateway<TContext = void>(
  handler: (req: NextRequest, ctx: TContext) => Promise<NextResponse>,
  prepare: (
    req: NextRequest,
  ) => Promise<{ quote: GatewayQuote; ctx: TContext }>,
  endpoint: string,
) {
  return async (req: NextRequest) => {
    const { quote, ctx } = await prepare(req);
    const requirements = buildPaymentRequirements(quote.price);

    if (quote.reason) {
      console.log(`[x402] Quote: ${quote.reason}`);
    }

    const paymentSignature = req.headers.get("payment-signature");

    // No payment — return 402 with Gateway batching payment requirements
    if (!paymentSignature) {
      console.log(`[x402] 402 Payment Required: ${endpoint} @ ${quote.price}`);

      const paymentRequired = buildPaymentRequired(endpoint, quote, requirements);

      return new NextResponse(JSON.stringify({}), {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-REQUIRED": Buffer.from(
            JSON.stringify(paymentRequired),
          ).toString("base64"),
        },
      });
    }

    // Payment present — verify and settle via Circle Gateway
    try {
      const paymentPayload: PaymentPayload = JSON.parse(
        Buffer.from(paymentSignature, "base64").toString("utf-8"),
      );

      const verifyResult = await facilitator.verify(
        paymentPayload,
        requirements,
      );

      if (!verifyResult.isValid) {
        return NextResponse.json(
          {
            error: "Payment verification failed",
            reason: verifyResult.invalidReason,
          },
          { status: 402 },
        );
      }

      const settleResult = await facilitator.settle(
        paymentPayload,
        requirements,
      );

      if (!settleResult.success) {
        console.error(
          `[x402] Settlement failed for ${endpoint}: ${settleResult.errorReason}`,
        );
        return NextResponse.json(
          {
            error: "Payment settlement failed",
            reason: settleResult.errorReason,
          },
          { status: 402 },
        );
      }

      // Record payment event in Supabase
      const amountUsdc = (Number(requirements.amount) / 1e6).toString();
      const payer = settleResult.payer ?? verifyResult.payer ?? "unknown";
      const paymentSource = resolvePaymentSource(req);

      const paymentRaw = {
        requirements,
        settleResult,
        quoted_price_usdc: quote.priceUsdc ?? amountUsdc,
        price_reason: quote.reason,
        source: paymentSource,
        stream_session: req.headers.get(STREAM_SESSION_HEADER),
        stream_tick: req.headers.get(STREAM_TICK_HEADER),
      };

      const { error } = await supabase.from("payment_events").insert({
        endpoint,
        payer,
        amount_usdc: amountUsdc,
        network: requirements.network,
        gateway_tx: settleResult.transaction ?? null,
        raw: paymentRaw,
      });

      if (error) {
        console.error("Failed to record payment event:", error.message);
      }

      await recordStreamEvent(req, {
        endpoint,
        payer,
        amountUsdc,
        gatewayTx: settleResult.transaction ?? null,
        raw: paymentRaw,
      });

      console.log(
        `[x402] Payment settled: ${endpoint} — ${amountUsdc} USDC from ${payer}`,
      );

      // Call the actual route handler
      const response = await handler(req, ctx);

      // Forward settlement info to the client
      const settleResponseHeader = Buffer.from(
        JSON.stringify({
          success: true,
          transaction: settleResult.transaction,
          network: requirements.network,
          payer,
        }),
      ).toString("base64");

      response.headers.set("PAYMENT-RESPONSE", settleResponseHeader);
      return response;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error("[x402] Payment processing error:", message);
      return NextResponse.json(
        { error: "Payment processing error", message },
        { status: 500 },
      );
    }
  };
}

/** Backward-compatible wrapper for routes with a fixed price. */
export function withStaticGateway(
  handler: (req: NextRequest) => Promise<NextResponse>,
  price: string,
  endpoint: string,
) {
  return withGateway(
    (req) => handler(req),
    async () => ({
      quote: {
        price,
        reason: `static ${price.replace("$", "")} USDC`,
        priceUsdc: price.replace("$", ""),
      },
      ctx: undefined as void,
    }),
    endpoint,
  );
}
