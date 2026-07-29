// Analytics propio, privacidad primero: sin cookies, sin PII, fire-and-forget.

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function track(
  name: string,
  metadata?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ name, path: window.location.pathname, metadata });
  try {
    // keepalive permite enviar durante la navegación sin bloquear.
    void fetch(`${apiBase()}/v1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Nunca romper la UI por analytics.
  }
}

export function sendFeedback(message: string, contact?: string): Promise<Response> {
  return fetch(`${apiBase()}/v1/feedback`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message,
      contact: contact || undefined,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    }),
  });
}
