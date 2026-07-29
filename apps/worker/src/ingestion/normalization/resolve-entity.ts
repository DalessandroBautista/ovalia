import {
  conflict,
  quarantined,
  valid,
  type IngestionOutcome,
} from '@ovalia/domain';
import { normalizeName } from './text';

export interface EntityLookups {
  /** Devuelve el ID de Ovalia asociado a un external ID, o null. */
  byExternalId(externalId: string): string | null;
  /** Devuelve los IDs de Ovalia cuyo alias normalizado coincide exactamente. */
  byAlias(normalizedName: string): string[];
}

export interface ResolvableEntity {
  externalId: string;
  name: string;
}

/**
 * Resuelve una entidad (equipo/competencia) por:
 * 1) external ID ya asociado; 2) alias exacto normalizado único.
 * Nunca crea asociaciones ambiguas: coincidencia múltiple → conflicto;
 * ninguna coincidencia → cuarentena para revisión manual.
 */
export function resolveEntity(
  entity: ResolvableEntity,
  lookups: EntityLookups,
): IngestionOutcome<{ ovaliaId: string }> {
  const byId = lookups.byExternalId(entity.externalId);
  if (byId) return valid({ ovaliaId: byId });

  const normalized = normalizeName(entity.name);
  const matches = Array.from(new Set(lookups.byAlias(normalized)));
  if (matches.length === 1) return valid({ ovaliaId: matches[0]! });
  if (matches.length > 1) {
    return conflict(matches, `alias ambiguo para "${entity.name}"`);
  }
  return quarantined(entity, `entidad sin resolver: "${entity.name}"`);
}
