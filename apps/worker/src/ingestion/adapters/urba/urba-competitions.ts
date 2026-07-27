/** Competencias URBA prioritarias (temporada 2026) con su championshipId y slug canónico. */
export interface UrbaCompetitionRef {
  externalId: string;
  name: string;
  slug: string;
}

export const URBA_PRIORITY_COMPETITIONS: readonly UrbaCompetitionRef[] = [
  { externalId: '2025176', name: 'TOP 14 - Superior', slug: 'urba-top-14' },
  { externalId: '2025177', name: 'PRIMERA A - Superior', slug: 'urba-primera-a' },
  { externalId: '2025178', name: 'PRIMERA B - Superior', slug: 'urba-primera-b' },
  { externalId: '2025179', name: 'PRIMERA C - Superior', slug: 'urba-primera-c' },
  { externalId: '2025180', name: 'SEGUNDA - Superior', slug: 'urba-segunda' },
  { externalId: '2025181', name: 'TERCERA - Superior', slug: 'urba-tercera' },
  { externalId: '2025182', name: 'DESARROLLO - Superior', slug: 'urba-desarrollo' },
  { externalId: '2025208', name: 'FEMENINO - TOP 9', slug: 'urba-femenino-top-9' },
];

export const URBA_PRIORITY_IDS = URBA_PRIORITY_COMPETITIONS.map((c) => Number(c.externalId));

/** Mapa externalId → slug canónico para las competencias prioritarias. */
export const URBA_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  URBA_PRIORITY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);
