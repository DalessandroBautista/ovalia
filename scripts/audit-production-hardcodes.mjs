#!/usr/bin/env node
// Auditoría de hardcodes productivos prohibidos.
// Ver plan Hito 0.3 y docs/data-sources/hardcoded-data-inventory.md.
// Falla ante violaciones NO presentes en scripts/hardcode-allowlist.json.
// La allowlist debe reducirse hito a hito hasta quedar vacía (Hito 17).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..');

const SCAN_ROOTS = ['apps', 'packages'];
const CODE_EXT = /\.(mjs|cjs|jsx?|tsx?)$/;
const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', '.next', '.turbo', 'coverage', 'build', '.git',
  '__fixtures__', '__tests__', '__mocks__', 'test', 'tests',
]);
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;

const RULES = [
  {
    id: 'demo-data-import',
    desc: 'import productivo de demo-data',
    scope: ['apps', 'packages'],
    re: /from\s+['"][^'"]*demo-data['"]/,
  },
  {
    id: 'forbidden-identifier',
    desc: 'array operativo conocido (matchCards / urbaStandings / tournamentGroups)',
    scope: ['apps', 'packages'],
    re: /\b(matchCards|urbaStandings|tournamentGroups)\b/,
  },
  {
    id: 'href-hash',
    desc: 'navegación placeholder a "#"',
    scope: ['apps/web'],
    re: /href=(?:"#"|'#'|\{[^}]*['"]#['"][^}]*\})/,
  },
  {
    id: 'countdown-literal',
    desc: 'cuenta regresiva literal con formato HH:MM:SS',
    scope: ['apps/web'],
    re: /\b\d{2}:\d{2}:\d{2}\b/,
  },
  {
    id: 'provider-url',
    desc: 'URL de proveedor externo en código cliente',
    scope: ['apps/web'],
    re: /https?:\/\/[^\s'"]*(highlightly|rapidapi|world\.rugby|urba\.org|uar\.com|sanzaar)/i,
  },
  {
    id: 'secret-literal',
    desc: 'secreto o API key versionado',
    scope: ['apps', 'packages'],
    re: /(sk-[A-Za-z0-9]{20,}|x-rapidapi-key['"]?\s*[:=]\s*['"][A-Za-z0-9]{16,})/,
  },
];

function walk(dir, acc) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (EXCLUDE_DIRS.has(entry)) continue;
      walk(full, acc);
    } else if (CODE_EXT.test(entry) && !TEST_FILE.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

function inScope(relPath, scopes) {
  return scopes.some((s) => relPath === s || relPath.startsWith(`${s}/`));
}

export function runAudit() {
  const allowlist = JSON.parse(
    readFileSync(join(REPO_ROOT, 'scripts', 'hardcode-allowlist.json'), 'utf8'),
  );
  const files = [];
  for (const root of SCAN_ROOTS) {
    try {
      walk(join(REPO_ROOT, root), files);
    } catch {
      // root ausente: ignorar
    }
  }

  const violations = [];
  const allowedHits = new Set(); // `${ruleId}::${relPath}`

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).split('\\').join('/');
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (const rule of RULES) {
      if (!inScope(rel, rule.scope)) continue;
      for (let i = 0; i < lines.length; i += 1) {
        if (!rule.re.test(lines[i])) continue;
        const allowed = (allowlist[rule.id] ?? []).includes(rel);
        if (allowed) {
          allowedHits.add(`${rule.id}::${rel}`);
        } else {
          violations.push({
            rule: rule.id,
            desc: rule.desc,
            file: rel,
            line: i + 1,
            snippet: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  // Entradas de allowlist que ya no coinciden (candidatas a eliminar).
  const stale = [];
  for (const rule of RULES) {
    for (const rel of allowlist[rule.id] ?? []) {
      if (!allowedHits.has(`${rule.id}::${rel}`)) {
        stale.push({ rule: rule.id, file: rel });
      }
    }
  }

  return { violations, stale };
}

function main() {
  const { violations, stale } = runAudit();
  if (stale.length > 0) {
    console.warn('\n⚠ Entradas de allowlist obsoletas (ya no coinciden; eliminarlas):');
    for (const s of stale) console.warn(`  - [${s.rule}] ${s.file}`);
  }
  if (violations.length > 0) {
    console.error(`\n✖ ${violations.length} hardcode(s) productivo(s) fuera de la allowlist:`);
    for (const v of violations) {
      console.error(`  - [${v.rule}] ${v.file}:${v.line}  ${v.desc}`);
      console.error(`      ${v.snippet}`);
    }
    console.error('\nAgregá a la allowlist con justificación o eliminá el hardcode.');
    process.exit(1);
  }
  console.log('✓ Sin hardcodes productivos fuera de la allowlist.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
