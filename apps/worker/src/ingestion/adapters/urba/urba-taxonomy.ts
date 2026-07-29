export type UrbaTier = 'senior' | 'intermediate' | 'youth' | 'women' | 'university';

export interface UrbaTaxonomy {
  familySlug: string;
  tier: UrbaTier;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tierFromCategory(category: string): UrbaTier {
  const normalized = category.toLowerCase();
  if (/^menores de 22/.test(normalized)) return 'youth';
  if (/^(intermedia|preintermedia)/.test(normalized)) return 'intermediate';
  if (/^superior|^primera divisi[oó]n$/.test(normalized)) return 'senior';
  return 'senior';
}

/** Deriva familia (torneo del que es "hermana" esta competencia) y tier a partir del
 * nombre crudo de URBA, que sigue el patrón "DIVISIÓN - CATEGORÍA" para las divisiones
 * de clubes, o nombres propios para femenino/juveniles/universitario/formativo. */
export function deriveUrbaTaxonomy(name: string): UrbaTaxonomy {
  if (/^femenino\b/i.test(name)) {
    return { familySlug: 'femenino', tier: 'women' };
  }
  const menoresMatch = name.match(/^menores de (\d+)/i);
  if (menoresMatch) {
    return { familySlug: `menores-de-${menoresMatch[1]}`, tier: 'youth' };
  }
  if (/^rugby universitario/i.test(name)) {
    return { familySlug: 'rugby-universitario', tier: 'university' };
  }
  if (/^rugby formativo/i.test(name)) {
    return { familySlug: 'rugby-formativo', tier: 'university' };
  }
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    const [division, ...rest] = parts;
    const category = rest.join(' - ');
    return { familySlug: slugify(division!), tier: tierFromCategory(category) };
  }
  return { familySlug: slugify(name), tier: 'senior' };
}
