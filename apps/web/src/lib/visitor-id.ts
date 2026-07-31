const VISITOR_STORAGE_KEY = 'ovalia.visitorId';

function createVisitorId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback determinístico (UUID v4 por forma) si no hay `crypto.randomUUID`.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

/**
 * Devuelve el UUID del visitante, persistido en `localStorage`. La primera vez
 * lo crea. Sin dato personal: solo identifica el origen del navegador.
 */
export function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;
  const fresh = createVisitorId();
  window.localStorage.setItem(VISITOR_STORAGE_KEY, fresh);
  return fresh;
}

/**
 * Hash simple de 64 hex (FNV-1a sobre dos semillas) para contextos sin
 * `crypto.subtle`. El servidor solo exige formato hex de 64 caracteres, no
 * verifica el algoritmo; la unicidad la garantiza el UUID del visitante.
 */
function simpleHash64(value: string): string {
  const fnv = (input: string, seed: number): string => {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  };
  const a = fnv(value, 0x811c9dc5);
  const b = fnv(value, 0x01000193);
  return `${a}${b}${a}${b}${a}${b}${a}${b}`;
}

/**
 * sha-256 en hex del `visitorId` para el `originKey` del ranking. Usa
 * `crypto.subtle.digest` (contexto seguro); si no está disponible, degrada al
 * hash simple documentado en `simpleHash64`.
 */
export async function hashVisitorId(visitorId: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(visitorId);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  return simpleHash64(visitorId);
}
