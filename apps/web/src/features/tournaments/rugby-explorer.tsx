'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>('button, a')];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [drawerOpen]);

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
          <header><strong>Uniones y torneos</strong><button type="button" aria-label="Cerrar explorador" onClick={() => setDrawerOpen(false)}>×</button></header>
          <ExplorerNavigation {...props} closeDrawer={() => setDrawerOpen(false)} />
        </div>
      ) : null}
    </>
  );
}
