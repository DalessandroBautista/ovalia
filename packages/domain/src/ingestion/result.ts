/** Resultado de normalizar/resolver una entidad importada. */
export type IngestionOutcome<T> =
  | { kind: 'valid'; value: T }
  | { kind: 'conflict'; candidates: unknown[]; reason: string }
  | { kind: 'quarantined'; raw: unknown; reason: string }
  | { kind: 'skipped'; reason: string };

export function valid<T>(value: T): IngestionOutcome<T> {
  return { kind: 'valid', value };
}

export function conflict<T>(candidates: unknown[], reason: string): IngestionOutcome<T> {
  return { kind: 'conflict', candidates, reason };
}

export function quarantined<T>(raw: unknown, reason: string): IngestionOutcome<T> {
  return { kind: 'quarantined', raw, reason };
}

export function skipped<T>(reason: string): IngestionOutcome<T> {
  return { kind: 'skipped', reason };
}
