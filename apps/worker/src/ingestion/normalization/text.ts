import { normalizeTeamName } from '@ovalia/domain';

/** Normaliza Unicode, mayúsculas, tildes y separadores para comparar nombres. */
export function normalizeName(value: string): string {
  return normalizeTeamName(value);
}

const ABBREVIATIONS: Readonly<Record<string, string>> = {
  'c a': 'club atletico',
  cav: 'club atletico',
  rc: 'rugby club',
};

/** Expande abreviaturas comunes tras normalizar (uso conservador). */
export function expandAbbreviations(normalized: string): string {
  let result = normalized;
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${abbr}\\b`, 'g'), full);
  }
  return result;
}
