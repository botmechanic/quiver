import { randomUUID } from "node:crypto";

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

export function createDemoStreamSession(ip: string): DemoStreamSession {
  const session: DemoStreamSession = {
    id: randomUUID(),
    ip,
    startedAt: Date.now(),
    tickCount: 0,
    stopped: false,
  };
  sessions.set(session.id, session);
  return session;
}

export function getDemoStreamSession(sessionId: string): DemoStreamSession | null {
  return sessions.get(sessionId) ?? null;
}

export function stopDemoStreamSession(sessionId: string): DemoStreamSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.stopped = true;
  return session;
}

export function validateStreamTick(
  session: DemoStreamSession,
  ip: string,
  tick: number,
): { ok: true } | { ok: false; message: string } {
  if (session.stopped) {
    return { ok: false, message: "Stream session already stopped" };
  }
  if (session.ip !== ip) {
    return { ok: false, message: "Session IP mismatch" };
  }
  if (Date.now() - session.startedAt > MAX_SESSION_MS) {
    session.stopped = true;
    return { ok: false, message: "Stream session timed out" };
  }
  if (session.tickCount >= MAX_TICKS_PER_SESSION) {
    session.stopped = true;
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

export function advanceStreamTick(session: DemoStreamSession): void {
  session.tickCount += 1;
}

export function getStreamRateUsdc(): string {
  return "0.000100";
}

export function expectedStreamTotal(tickCount: number): string {
  return (tickCount * 0.0001).toFixed(6);
}
