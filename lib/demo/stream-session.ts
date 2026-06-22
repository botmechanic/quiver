import { randomUUID } from "node:crypto";
import {
  loadStreamSession,
  persistStreamSession,
} from "@/lib/demo/stream-session-store";

const MAX_TICKS_PER_SESSION = Number(process.env.STREAM_MAX_TICKS ?? "120");
const MAX_SESSION_MS = Number(process.env.STREAM_MAX_DURATION_MS ?? "300000");

export interface DemoStreamSession {
  id: string;
  ip: string;
  startedAt: number;
  tickCount: number;
  stopped: boolean;
}

const sessions = new Map<string, DemoStreamSession>();

function cacheSession(session: DemoStreamSession): DemoStreamSession {
  sessions.set(session.id, session);
  return session;
}

export async function createDemoStreamSession(
  ip: string,
): Promise<DemoStreamSession> {
  const session: DemoStreamSession = {
    id: randomUUID(),
    ip,
    startedAt: Date.now(),
    tickCount: 0,
    stopped: false,
  };
  cacheSession(session);
  await persistStreamSession(session);
  return session;
}

export async function resolveDemoStreamSession(
  sessionId: string,
): Promise<DemoStreamSession | null> {
  const cached = sessions.get(sessionId);
  if (cached) return cached;

  const loaded = await loadStreamSession(sessionId);
  if (!loaded) return null;
  return cacheSession(loaded);
}

/** Re-read session state from Supabase and refresh the per-instance cache. */
export async function refreshDemoStreamSessionFromDb(
  sessionId: string,
): Promise<DemoStreamSession | null> {
  const loaded = await loadStreamSession(sessionId);
  if (!loaded) return null;
  return cacheSession(loaded);
}

export async function stopDemoStreamSession(
  sessionId: string,
): Promise<DemoStreamSession | null> {
  const session = await resolveDemoStreamSession(sessionId);
  if (!session) return null;
  session.stopped = true;
  await persistStreamSession(session);
  return session;
}

export async function failDemoStreamSession(
  sessionId: string,
  reason: string,
): Promise<DemoStreamSession | null> {
  const session = await resolveDemoStreamSession(sessionId);
  if (!session) return null;
  session.stopped = true;
  console.log(`[demo/stream] Session ${sessionId} closed: ${reason}`);
  await persistStreamSession(session);
  return session;
}

export async function validateStreamTick(
  session: DemoStreamSession,
  ip: string,
  tick: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (session.stopped) {
    return { ok: false, message: "Stream session already stopped" };
  }
  if (session.ip !== ip) {
    return { ok: false, message: "Session IP mismatch" };
  }
  if (Date.now() - session.startedAt > MAX_SESSION_MS) {
    session.stopped = true;
    await persistStreamSession(session);
    return { ok: false, message: "Stream session timed out" };
  }
  if (session.tickCount >= MAX_TICKS_PER_SESSION) {
    session.stopped = true;
    await persistStreamSession(session);
    return { ok: false, message: "Stream tick limit reached" };
  }
  if (tick !== session.tickCount + 1) {
    return {
      ok: false,
      message: `Expected tick ${session.tickCount + 1}, got ${tick}`,
    };
  }
  return { ok: true };
}

export async function advanceStreamTick(
  session: DemoStreamSession,
): Promise<void> {
  session.tickCount += 1;
  await persistStreamSession(session);
}

export function getStreamRateUsdc(): string {
  return "0.000100";
}

export function expectedStreamTotal(tickCount: number): string {
  return (tickCount * 0.0001).toFixed(6);
}
