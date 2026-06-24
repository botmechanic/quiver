import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  OWNCAST_CLIENT_HEADER,
  OWNCAST_EVENT_HEADER,
  OWNCAST_USER_HEADER,
} from "../lib/stream/headers.ts";
import { startStream, type StreamSession } from "../lib/scout/stream.ts";
import {
  describeOwncastStreamer,
  getOwncastStreamerConfig,
} from "../lib/owncast/registry.ts";

type JsonRecord = Record<string, unknown>;

interface OwncastWebhookPayload {
  type?: string;
  eventData?: {
    id?: string;
    timestamp?: string;
    clientId?: number | string;
    user?: {
      id?: string;
      displayName?: string;
    };
  };
}

interface ActiveOwncastSession {
  key: string;
  clientId: string | null;
  userId: string | null;
  displayName: string | null;
  joinedAt: string | null;
  startedAtMs: number;
  session: StreamSession;
  closing: boolean;
}

const port = parseInteger(process.env.OWNCAST_SIDECAR_PORT, 8787);
const owncastUrl = trimTrailingSlash(
  process.env.OWNCAST_URL ?? "http://localhost:8080",
);
const owncastAccessToken = process.env.OWNCAST_ACCESS_TOKEN;
const quiverBaseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const tickIntervalMs = parseInteger(process.env.OWNCAST_TICK_INTERVAL_MS, 1000);
const heartbeatMs = parseInteger(process.env.OWNCAST_HEARTBEAT_MS, 2000);
const maxTicks = parseOptionalInteger(process.env.OWNCAST_MAX_TICKS);
const maxSpendUsdc = parseOptionalNumber(process.env.OWNCAST_MAX_SPEND_USDC);
const maxSessionMs = parseInteger(process.env.OWNCAST_MAX_SESSION_MS, 5 * 60_000);
const startOnChat = process.env.OWNCAST_START_ON_CHAT !== "false";

const active = new Map<string, ActiveOwncastSession>();
const pending = new Set<string>();
const streamer = getOwncastStreamerConfig();

console.log(`[owncast] Sidecar for ${describeOwncastStreamer(streamer)}`);
console.log(`[owncast] Owncast: ${owncastUrl}`);
console.log(`[owncast] Quiver: ${quiverBaseUrl}`);

if (!owncastAccessToken) {
  console.warn(
    "[owncast] OWNCAST_ACCESS_TOKEN is missing; heartbeat polling will fail unless USER_PARTED arrives.",
  );
}

function parseInteger(value: string | undefined, fallback: number): number {
  const parsed = value ? parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === "object"
    ? (value as JsonRecord)
    : {};
}

function stringifyId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizePayload(value: unknown): OwncastWebhookPayload {
  const payload = asRecord(value);
  const eventData = asRecord(payload.eventData);
  const user = asRecord(eventData.user);

  return {
    type: typeof payload.type === "string" ? payload.type : undefined,
    eventData: {
      id: typeof eventData.id === "string" ? eventData.id : undefined,
      timestamp:
        typeof eventData.timestamp === "string"
          ? eventData.timestamp
          : undefined,
      clientId: stringifyId(eventData.clientId) ?? undefined,
      user: {
        id: typeof user.id === "string" ? user.id : undefined,
        displayName:
          typeof user.displayName === "string" ? user.displayName : undefined,
      },
    },
  };
}

function presenceKey(payload: OwncastWebhookPayload): string | null {
  const userId = payload.eventData?.user?.id;
  if (userId) return `user:${userId}`;

  const clientId = stringifyId(payload.eventData?.clientId);
  if (clientId) return `client:${clientId}`;

  const eventId = payload.eventData?.id;
  return eventId ? `event:${eventId}` : null;
}

function metadataHeaders(
  payload: OwncastWebhookPayload,
  eventType: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    [OWNCAST_EVENT_HEADER]: eventType,
  };
  const clientId = stringifyId(payload.eventData?.clientId);
  const userId = payload.eventData?.user?.id;

  if (clientId) headers[OWNCAST_CLIENT_HEADER] = clientId;
  if (userId) headers[OWNCAST_USER_HEADER] = userId;

  return headers;
}

async function openPresenceStream(
  payload: OwncastWebhookPayload,
  eventType: string,
): Promise<void> {
  const key = presenceKey(payload);
  if (!key) {
    console.warn("[owncast] Ignoring presence event without client or user id");
    return;
  }
  if (active.has(key) || pending.has(key)) return;

  pending.add(key);
  try {
    const session = await startStream({
      baseUrl: quiverBaseUrl,
      extraHeaders: metadataHeaders(payload, eventType),
      maxSpendUsdc,
      maxTicks,
      sessionId: randomUUID(),
      tickIntervalMs,
    });

    active.set(key, {
      key,
      clientId: stringifyId(payload.eventData?.clientId),
      userId: payload.eventData?.user?.id ?? null,
      displayName: payload.eventData?.user?.displayName ?? null,
      joinedAt: payload.eventData?.timestamp ?? null,
      startedAtMs: Date.now(),
      session,
      closing: false,
    });

    console.log(
      `[owncast] Started stream ${session.sessionId} for ${key} (${payload.eventData?.user?.displayName ?? "anonymous"})`,
    );
  } catch (error) {
    console.error(
      `[owncast] Failed to start stream for ${key}: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    pending.delete(key);
  }
}

async function stopPresenceStream(key: string, reason: string): Promise<void> {
  const record = active.get(key);
  if (!record || record.closing) return;

  record.closing = true;
  console.log(`[owncast] Stopping ${record.session.sessionId}: ${reason}`);
  await record.session.stop();
  active.delete(key);
}

async function fetchConnectedClients(): Promise<JsonRecord[]> {
  const url = `${owncastUrl}/api/integrations/clients`;
  const headers: Record<string, string> = {};
  if (owncastAccessToken) {
    headers.Authorization = `Bearer ${owncastAccessToken}`;
  }

  const first = await fetch(url, { headers });
  if (first.ok) return (await first.json()) as JsonRecord[];

  if (!owncastAccessToken) {
    throw new Error(`Owncast clients request failed: ${first.status}`);
  }

  const fallback = await fetch(
    `${url}?accessToken=${encodeURIComponent(owncastAccessToken)}`,
  );
  if (!fallback.ok) {
    throw new Error(`Owncast clients request failed: ${fallback.status}`);
  }
  return (await fallback.json()) as JsonRecord[];
}

function clientMatches(record: ActiveOwncastSession, client: JsonRecord): boolean {
  const user = asRecord(client.user);
  const ids = [
    stringifyId(client.id),
    stringifyId(client.clientId),
    stringifyId(client.clientID),
  ].filter((value): value is string => value !== null);

  if (record.clientId && ids.includes(record.clientId)) return true;
  return Boolean(record.userId && user.id === record.userId);
}

async function pollHeartbeat(): Promise<void> {
  if (active.size === 0) return;

  const clients = await fetchConnectedClients();
  const now = Date.now();

  await Promise.all(
    [...active.values()].map(async (record) => {
      if (!record.session.running) {
        active.delete(record.key);
        return;
      }

      if (now - record.startedAtMs > maxSessionMs) {
        await stopPresenceStream(record.key, "max session duration reached");
        return;
      }

      const present = clients.some((client) => clientMatches(record, client));
      if (!present) {
        await stopPresenceStream(record.key, "Owncast heartbeat missing");
      }
    }),
  );
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleWebhook(payload: OwncastWebhookPayload): Promise<void> {
  const eventType = payload.type?.toUpperCase();
  const key = presenceKey(payload);

  if (eventType === "USER_JOINED" || (startOnChat && eventType === "CHAT")) {
    await openPresenceStream(payload, eventType);
    return;
  }

  if (eventType === "USER_PARTED" && key) {
    await stopPresenceStream(key, "USER_PARTED webhook");
    return;
  }

  console.log(`[owncast] Ignored webhook event ${eventType ?? "unknown"}`);
}

const server = createServer((req, res) => {
  void (async () => {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        active_sessions: [...active.values()].map((record) => ({
          key: record.key,
          session_id: record.session.sessionId,
          tick_count: record.session.tickCount,
          total_usdc: record.session.totalUsdc.toFixed(6),
          display_name: record.displayName,
          joined_at: record.joinedAt,
        })),
      });
      return;
    }

    if (req.method === "POST" && req.url === "/webhooks/incoming") {
      const payload = normalizePayload(await readJson(req));
      await handleWebhook(payload);
      sendJson(res, 202, {
        ok: true,
        event: payload.type ?? null,
        active_sessions: active.size,
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  })().catch((error) => {
    console.error(
      `[owncast] Request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    sendJson(res, 500, { error: "Request failed" });
  });
});

const heartbeat = setInterval(() => {
  void pollHeartbeat().catch((error) => {
    console.error(
      `[owncast] Heartbeat failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}, heartbeatMs);

async function shutdown(signal: string): Promise<void> {
  console.log(`[owncast] ${signal}: stopping ${active.size} active session(s)`);
  clearInterval(heartbeat);
  await Promise.all(
    [...active.keys()].map((key) => stopPresenceStream(key, signal)),
  );
  server.close(() => process.exit(0));
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

server.listen(port, () => {
  console.log(`[owncast] Listening on http://localhost:${port}/webhooks/incoming`);
});
