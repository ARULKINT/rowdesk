import "server-only";

/**
 * Lightweight same-origin check for mutating Route Handlers. Session cookies
 * are already SameSite=Lax, which blocks cross-site POSTs from most browsers;
 * this adds a defense-in-depth Origin/Referer check on top.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin requests from same-site navigations may omit Origin
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
