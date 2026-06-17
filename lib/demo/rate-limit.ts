const COOLDOWN_MS =
  (parseInt(process.env.DEMO_RATE_LIMIT_SECONDS ?? "30", 10) || 30) * 1000;

const lastRequestByIp = new Map<string, number>();

export function checkDemoRateLimit(ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const last = lastRequestByIp.get(ip);

  if (last !== undefined && now - last < COOLDOWN_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((COOLDOWN_MS - (now - last)) / 1000),
    };
  }

  lastRequestByIp.set(ip, now);
  return { allowed: true };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
