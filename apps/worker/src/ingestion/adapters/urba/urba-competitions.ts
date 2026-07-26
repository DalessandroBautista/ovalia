/** Competencias URBA prioritarias (temporada 2026) con su championshipId. */
export interface UrbaCompetitionRef {
  externalId: string;
  name: string;
}

export const URBA_PRIORITY_COMPETITIONS: readonly UrbaCompetitionRef[] = [
  { externalId: '2025176', name: 'TOP 14 - Superior' },
  { externalId: '2025177', name: 'PRIMERA A - Superior' },
  { externalId: '2025178', name: 'PRIMERA B - Superior' },
  { externalId: '2025179', name: 'PRIMERA C - Superior' },
  { externalId: '2025180', name: 'SEGUNDA - Superior' },
  { externalId: '2025181', name: 'TERCERA - Superior' },
  { externalId: '2025182', name: 'DESARROLLO - Superior' },
  { externalId: '2025208', name: 'FEMENINO - TOP 9' },
];

export const URBA_PRIORITY_IDS = URBA_PRIORITY_COMPETITIONS.map((c) => Number(c.externalId));
