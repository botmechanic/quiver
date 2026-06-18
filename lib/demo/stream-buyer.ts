import {
  STREAM_SESSION_HEADER,
  STREAM_TICK_HEADER,
} from "@/lib/stream/headers";
import {
  ensureGatewayBalance,
  getDemoSession,
  resolveBaseUrl,
} from "@/lib/demo/gateway-buyer";

export { resolveBaseUrl };

export async function executeDemoStreamTick(
  sessionId: string,
  tick: number,
  targetUrl: string,
) {
  const session = await getDemoSession();
  await ensureGatewayBalance(session);

  const start = Date.now();
  const result = await session.gateway.pay(targetUrl, {
    method: "GET",
    headers: {
      [STREAM_SESSION_HEADER]: sessionId,
      [STREAM_TICK_HEADER]: String(tick),
    },
  });

  return {
    data: result.data,
    amount: result.formattedAmount,
    transaction: result.transaction,
    payer: session.gateway.address,
    elapsedMs: Date.now() - start,
  };
}
