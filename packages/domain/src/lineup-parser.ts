/**
 * Parser puro de texto de formación a entradas estructuradas.
 *
 * Convierte texto pegado por un editor (formato típico de publicación
 * de planteles) en una lista de entradas con número, nombre, capitán
 * y clasificación titular/suplente.
 */

export interface ParsedLineupEntry {
  shirtNumber: number;
  name: string;
  isCaptain: boolean;
  isStarter: boolean;
}

export interface ParsedLineup {
  entries: ParsedLineupEntry[];
  warnings: string[];
}

const STARTER_THRESHOLD = 15;
const MIN_SHIRT = 1;
const MAX_SHIRT = 99;

// Captura: número (1-2 dígitos), separador opcional (. o espacio),
// nombre (todo lo que sigue hasta el final o marca de capitán),
// marca de capitán opcional: (c), (C), [c], [C].
const LINE_PATTERN = /^\s*(\d{1,2})\s*[.\s]\s*(.+?)\s*$/;
const CAPTAIN_PATTERN = /\s*(?:\((?:c|C)\)|\[(?:c|C)\])\s*$/;

export function parseLineupText(raw: string): ParsedLineup {
  if (!raw || !raw.trim()) {
    return { entries: [], warnings: [] };
  }

  const lines = raw.split('\n');
  const entries: ParsedLineupEntry[] = [];
  const warnings: string[] = [];
  const seenNumbers = new Set<number>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = LINE_PATTERN.exec(trimmed);
    if (!match) {
      warnings.push(`No se pudo interpretar: "${trimmed}"`);
      continue;
    }

    const shirtNumber = Number(match[1]);
    if (shirtNumber < MIN_SHIRT || shirtNumber > MAX_SHIRT) {
      warnings.push(`Número fuera de rango: "${trimmed}"`);
      continue;
    }

    if (seenNumbers.has(shirtNumber)) {
      warnings.push(`Número ${shirtNumber} duplicado: "${trimmed}"`);
      continue;
    }
    seenNumbers.add(shirtNumber);

    let namePart = match[2]!;
    const isCaptain = CAPTAIN_PATTERN.test(namePart);
    if (isCaptain) {
      namePart = namePart.replace(CAPTAIN_PATTERN, '');
    }

    const name = namePart.trim();
    if (!name) {
      warnings.push(`Nombre vacío para número ${shirtNumber}: "${trimmed}"`);
      continue;
    }

    entries.push({
      shirtNumber,
      name,
      isCaptain,
      isStarter: shirtNumber <= STARTER_THRESHOLD,
    });
  }

  return { entries, warnings };
}
