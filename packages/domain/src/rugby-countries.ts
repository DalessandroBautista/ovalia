/**
 * Catálogo de países relevantes para el rugby mundial.
 *
 * Cada país define metadatos de visualización y un `kind` que indica
 * cómo se agrupan sus organizaciones:
 * - `country`: agrupa uniones regionales (ej: Argentina → URBA, Córdoba, etc.)
 * - `international`: agrupa torneos que no pertenecen a un país específico
 *   (ej: Super Rugby, Rugby Championship, Six Nations).
 */

export interface RugbyCountryDefinition {
  /** ISO 3166-1 alpha-2 o slug especial para torneos internacionales. */
  code: string;
  /** Nombre legible del país o sección. */
  name: string;
  /** Etiqueta corta para el explorador lateral. */
  shortName: string;
  /** Emoji de bandera o ícono representativo. */
  flag: string;
  /** Prioridad de visualización (mayor = más arriba). */
  priority: number;
  /**
   * Agrupación:
   * - `country`: las organizaciones se filtran por `countryCode === code`
   * - `international`: agrupa organizaciones con kind `league` / `international` / `sevens`
   *   o cuyo `countryCode` no coincide con ningún país del catálogo.
   */
  kind: 'country' | 'international';
}

export const RUGBY_COUNTRIES: readonly RugbyCountryDefinition[] = [
  {
    code: 'AR',
    name: 'Argentina',
    shortName: 'Argentina',
    flag: '\u{1F1E6}\u{1F1F7}',
    priority: 100,
    kind: 'country',
  },
  {
    code: 'FR',
    name: 'Francia',
    shortName: 'Francia',
    flag: '\u{1F1EB}\u{1F1F7}',
    priority: 90,
    kind: 'country',
  },
  {
    code: 'GB',
    name: 'Gran Breta\u00f1a',
    shortName: 'Gran Breta\u00f1a',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    priority: 85,
    kind: 'country',
  },
  {
    code: 'IE',
    name: 'Irlanda',
    shortName: 'Irlanda',
    flag: '\u{1F1EE}\u{1F1EA}',
    priority: 80,
    kind: 'country',
  },
  {
    code: 'IT',
    name: 'Italia',
    shortName: 'Italia',
    flag: '\u{1F1EE}\u{1F1F9}',
    priority: 75,
    kind: 'country',
  },
  {
    code: 'NZ',
    name: 'Nueva Zelanda',
    shortName: 'Nueva Zelanda',
    flag: '\u{1F1F3}\u{1F1FF}',
    priority: 70,
    kind: 'country',
  },
  {
    code: 'ZA',
    name: 'Sud\u00e1frica',
    shortName: 'Sud\u00e1frica',
    flag: '\u{1F1FF}\u{1F1E6}',
    priority: 65,
    kind: 'country',
  },
  {
    code: 'AU',
    name: 'Australia',
    shortName: 'Australia',
    flag: '\u{1F1E6}\u{1F1FA}',
    priority: 60,
    kind: 'country',
  },
  {
    code: 'JP',
    name: 'Jap\u00f3n',
    shortName: 'Jap\u00f3n',
    flag: '\u{1F1EF}\u{1F1F5}',
    priority: 40,
    kind: 'country',
  },
  {
    code: 'US',
    name: 'Estados Unidos',
    shortName: 'EE.UU.',
    flag: '\u{1F1FA}\u{1F1F8}',
    priority: 35,
    kind: 'country',
  },
  {
    code: 'international',
    name: 'Internacional',
    shortName: 'Internacional',
    flag: '\u{1F310}',
    priority: 95,
    kind: 'international',
  },
] as const;

const countryByCode = new Map(RUGBY_COUNTRIES.map((country) => [country.code, country]));

const countryCodes = new Set(
  RUGBY_COUNTRIES.filter((c) => c.kind === 'country').map((c) => c.code),
);

/**
 * Resuelve el país al que pertenece una organización según su `countryCode` y `kind`.
 *
 * - Si tiene `countryCode` que coincide con un país del catálogo → ese país.
 *   (el `countryCode` tiene prioridad sobre `kind`: un league con `countryCode`
 *   FR, como el Top 14, pertenece a Francia y no a Internacional).
 * - Si no tiene `countryCode` válido o es `null`, y su `kind` es
 *   {league, international, sevens} → internacional.
 * - Si tiene `countryCode` que no coincide con ningún país → internacional.
 */
export function resolveCountryForOrganization(
  organization: { countryCode: string | null; kind: string },
): RugbyCountryDefinition {
  if (organization.countryCode && countryCodes.has(organization.countryCode)) {
    return countryByCode.get(organization.countryCode)!;
  }
  if (
    organization.kind === 'league' ||
    organization.kind === 'international' ||
    organization.kind === 'sevens'
  ) {
    return countryByCode.get('international')!;
  }
  return countryByCode.get('international')!;
}

export function findCountryByCode(code: string): RugbyCountryDefinition | undefined {
  return countryByCode.get(code);
}

export function listCountries(): RugbyCountryDefinition[] {
  return [...RUGBY_COUNTRIES].sort((a, b) => b.priority - a.priority);
}
