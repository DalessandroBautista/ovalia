import type { SportsDataAdapter } from '@ovalia/domain';

export type AdapterFactory = () => SportsDataAdapter;

const registry = new Map<string, AdapterFactory>();

/** Registra un adaptador por slug de fuente (se llena en los hitos de fuentes). */
export function registerAdapter(slug: string, factory: AdapterFactory): void {
  registry.set(slug, factory);
}

export function getAdapter(slug: string): SportsDataAdapter | null {
  const factory = registry.get(slug);
  return factory ? factory() : null;
}

export function registeredSources(): string[] {
  return [...registry.keys()];
}
