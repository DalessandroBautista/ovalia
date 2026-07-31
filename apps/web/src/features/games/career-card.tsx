'use client';

import { useState } from 'react';
import type { ApiCareerEntry, ApiCareerSeasonRecord, ApiCareerSummary } from '../../lib/api/types';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Top',
  2: 'Primera A',
  3: 'Primera B',
  4: 'Primera C',
  5: 'Segunda',
  6: 'Tercera',
  7: 'Desarrollo',
};

function levelLabel(level: number): string {
  return LEVEL_LABELS[level] ?? `División ${level}`;
}

export interface CareerCardProps {
  entry?: ApiCareerEntry;
  summary?: ApiCareerSummary;
  history?: ApiCareerSeasonRecord[];
  displayName?: string;
  position?: string;
  shareUrl?: string;
}

export function CareerCard({ entry, summary, history, displayName, position, shareUrl }: CareerCardProps) {
  const [copied, setCopied] = useState(false);
  const effectiveSummary = entry?.summary ?? summary;
  const effectiveHistory = entry?.history ?? history ?? [];
  const name = entry?.displayName ?? displayName;
  const role = entry?.position ?? position;
  const url = entry ? `/juegos/carrera/${entry.id}` : shareUrl;

  if (!effectiveSummary) return null;

  const mejorMomento =
    effectiveHistory.length > 0
      ? effectiveHistory.reduce((best, record) => (record.rating > best.rating ? record : best))
      : undefined;

  const share = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Sin acceso al portapapeles no se rompe la tarjeta.
    }
  };

  return (
    <div className="game-result">
      <small>TU CARRERA</small>
      {name && <h2>{name}</h2>}
      {role && <strong>{role}</strong>}
      <p className="eyebrow">{effectiveSummary.tier}</p>
      <p>{effectiveSummary.verdict}</p>
      <p>
        <strong>Score {effectiveSummary.score}</strong>
      </p>
      {effectiveHistory.length > 0 && (
        <>
          <small>TRAYECTORIA</small>
          <ul className="career-timeline">
            {effectiveHistory.map((record) => (
              <li key={record.season}>
                <b>Temporada {record.season}</b> · {record.age} años · {record.clubName} · Rating {record.rating} ·{' '}
                {record.note}
              </li>
            ))}
          </ul>
          {mejorMomento && (
            <p>
              Mejor momento: Temporada {mejorMomento.season} con rating {mejorMomento.rating}.
            </p>
          )}
        </>
      )}
      {effectiveSummary.clubs.length > 0 && <p>Clubes: {effectiveSummary.clubs.join(', ')}.</p>}
      <p>Categoría máxima: {levelLabel(effectiveSummary.peakLevel)}.</p>
      <p>{effectiveSummary.comparison.reason}</p>
      {url && (
        <button onClick={share}>{copied ? 'Enlace copiado' : 'Compartir'}</button>
      )}
    </div>
  );
}
