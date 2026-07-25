'use client';

import { resolveTeamBadge } from '@ovalia/domain';
import { useEffect, useState } from 'react';

export interface TeamBadgeProps {
  name: string;
  shortCode: string;
  providerId?: number;
  badgeUrl?: string;
  size?: 'small' | 'large';
}

export function TeamBadge({ name, shortCode, providerId, badgeUrl, size = 'small' }: TeamBadgeProps) {
  const resolvedBadge = resolveTeamBadge({ name, providerId, remoteUrl: badgeUrl });
  const [visibleBadge, setVisibleBadge] = useState(resolvedBadge);

  useEffect(() => setVisibleBadge(resolvedBadge), [resolvedBadge]);

  return (
    <span className={`team-badge team-badge--${size}`} title={name} data-code={shortCode.slice(0, 3).toUpperCase()}>
      {visibleBadge ? (
        <img
          src={visibleBadge}
          alt={`Escudo de ${name}`}
          loading="lazy"
          onError={() => setVisibleBadge(undefined)}
        />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 54 62" role="presentation">
          <path d="M27 2 50 9v20c0 15-9 25-23 31C13 54 4 44 4 29V9L27 2Z" />
          <path d="M27 8 44 13v15c0 11-6 19-17 24-11-5-17-13-17-24V13L27 8Z" />
          <text x="27" y="34" textAnchor="middle">{shortCode.slice(0, 3)}</text>
        </svg>
      )}
    </span>
  );
}
