import type { Capability } from '@ovalia/domain';

/** Frecuencias por capacidad (segundos). Configurables por ambiente. */
export interface ScheduleConfig {
  catalog: number;
  fixtures: number;
  results: number;
  standings: number;
  news: number;
  live: number;
}

const DEFAULTS: ScheduleConfig = {
  catalog: 7 * 24 * 3600, // semanal
  fixtures: 6 * 3600, // cada 6 horas
  results: 600, // cada 10 minutos (ventana de partido)
  standings: 3600, // tras resultados / conciliación
  news: 1800, // cada 30 minutos
  live: 60,
};

function envSeconds(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Lee la configuración de frecuencias desde el ambiente (no constantes dispersas). */
export function loadScheduleConfig(): ScheduleConfig {
  return {
    catalog: envSeconds('INGEST_FREQ_CATALOG', DEFAULTS.catalog),
    fixtures: envSeconds('INGEST_FREQ_FIXTURES', DEFAULTS.fixtures),
    results: envSeconds('INGEST_FREQ_RESULTS', DEFAULTS.results),
    standings: envSeconds('INGEST_FREQ_STANDINGS', DEFAULTS.standings),
    news: envSeconds('INGEST_FREQ_NEWS', DEFAULTS.news),
    live: envSeconds('INGEST_FREQ_LIVE', DEFAULTS.live),
  };
}

/**
 * Decide qué capacidades están vencidas para una fuente dado el último run por
 * capacidad. Pura y determinista para poder testearse sin reloj real.
 */
export function dueCapabilities(
  capabilities: Capability[],
  lastRunAt: Partial<Record<Capability, Date>>,
  config: ScheduleConfig,
  now: Date,
): Capability[] {
  return capabilities.filter((capability) => {
    if (capability === 'live') return false; // el live se maneja aparte
    const last = lastRunAt[capability];
    if (!last) return true;
    const elapsedSeconds = (now.getTime() - last.getTime()) / 1000;
    return elapsedSeconds >= config[capability];
  });
}
