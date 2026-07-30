'use client';

import { useCallback, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import type { RugbyExplorerFamily, RugbyExplorerUnion } from './rugby-explorer-data';

interface RugbyExplorerProps {
  unions: RugbyExplorerUnion[];
  expandedUnionKey: string;
  selectedFamilyKey?: string;
  mode: 'catalog' | 'matches';
  onUnionSelect: (unionKey: string) => void;
  onFamilySelect?: (family: RugbyExplorerFamily, unionKey: string) => void;
  onClearFamily?: () => void;
}

function ExplorerNavigation({
  unions,
  expandedUnionKey,
  selectedFamilyKey,
  mode,
  onUnionSelect,
  onFamilySelect,
  onClearFamily,
  closeDrawer,
}: RugbyExplorerProps & { closeDrawer?: () => void }) {
  const selectFamily = (family: RugbyExplorerFamily, unionKey: string) => {
    onFamilySelect?.(family, unionKey);
    closeDrawer?.();
  };
  const navLabel = mode === 'matches' ? 'Uniones y partidos' : 'Uniones y torneos';
  return (
    <nav className="rugby-explorer__nav" aria-label={navLabel}>
      <header>
        <span>Uniones</span>
        <strong>{unions.length}</strong>
      </header>
      {mode === 'matches' && selectedFamilyKey ? (
        <button type="button" className="rugby-explorer__clear" onClick={() => { onClearFamily?.(); closeDrawer?.(); }}>
          Ver todos los partidos
        </button>
      ) : null}
      <div className="rugby-explorer__list">
        {unions.map((union) => {
          const expanded = union.key === expandedUnionKey;
          return (
            <section className={`rugby-explorer__item${expanded ? ' is-expanded' : ''}`} key={union.key}>
              <button
                type="button"
                className="rugby-explorer__union"
                aria-expanded={expanded}
                onClick={() => onUnionSelect(union.key)}
              >
                <span title={union.label}>{union.shortLabel}</span>
                <small>{union.families.length > 0 ? `${union.families.length} ${union.families.length === 1 ? 'torneo' : 'torneos'}` : 'Cobertura en preparación'}</small>
                <i aria-hidden="true">{expanded ? '−' : '+'}</i>
              </button>
              {expanded ? (
                <div className="rugby-explorer__families">
                  {union.families.length === 0 ? <p>Cobertura en preparación</p> : null}
                  {union.families.map((family) => mode === 'catalog' ? (
                    <a href={`/torneos/${family.canonicalSlug}`} key={family.key}>
                      <span>{family.title}</span><i aria-hidden="true">→</i>
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={family.key === selectedFamilyKey ? 'is-active' : ''}
                      aria-pressed={family.key === selectedFamilyKey}
                      onClick={() => selectFamily(family, union.key)}
                      key={family.key}
                    >
                      <span>{family.title}</span>{family.key === selectedFamilyKey ? <i aria-hidden="true">✓</i> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </nav>
  );
}

export function RugbyExplorer(props: RugbyExplorerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useFocusTrap({ active: drawerOpen, containerRef: drawerRef, onEscape: closeDrawer });

  return (
    <>
      <aside className="rugby-explorer">
        <ExplorerNavigation {...props} />
      </aside>
      <button
        type="button"
        className="rugby-explorer-trigger"
        aria-haspopup="dialog"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
        ref={triggerRef}
      >
        <span>Uniones y torneos</span><i aria-hidden="true">☰</i>
      </button>
      {drawerOpen ? (
        <div
          className="rugby-explorer-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={props.mode === 'matches' ? 'Uniones y partidos' : 'Uniones y torneos'}
          ref={drawerRef}
        >
          <header><strong>Uniones y torneos</strong><button type="button" aria-label="Cerrar explorador" onClick={closeDrawer}>×</button></header>
          <ExplorerNavigation {...props} closeDrawer={closeDrawer} />
        </div>
      ) : null}
    </>
  );
}
