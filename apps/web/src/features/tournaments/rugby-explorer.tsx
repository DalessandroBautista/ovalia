'use client';

import { useCallback, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import type { RugbyExplorerCountry, RugbyExplorerFamily, RugbyExplorerUnion } from './rugby-explorer-data';

interface RugbyExplorerProps {
  countries: RugbyExplorerCountry[];
  expandedCountryCodes: ReadonlySet<string>;
  expandedUnionKeys: ReadonlySet<string>;
  selectedFamilyKey?: string;
  mode: 'catalog' | 'matches';
  onCountrySelect: (countryCode: string) => void;
  onUnionSelect: (unionKey: string) => void;
  onFamilySelect?: (family: RugbyExplorerFamily, unionKey: string) => void;
  onClearFamily?: () => void;
}

function ExplorerNavigation({
  countries,
  expandedCountryCodes,
  expandedUnionKeys,
  selectedFamilyKey,
  mode,
  onCountrySelect,
  onUnionSelect,
  onFamilySelect,
  onClearFamily,
  closeDrawer,
}: RugbyExplorerProps & { closeDrawer?: () => void }) {
  const selectFamily = (family: RugbyExplorerFamily, unionKey: string) => {
    onFamilySelect?.(family, unionKey);
    closeDrawer?.();
  };
  const navLabel = mode === 'matches' ? 'Países y partidos' : 'Países y torneos';
  return (
    <nav className="rugby-explorer__nav" aria-label={navLabel}>
      <header>
        <span>Países</span>
        <strong>{countries.length}</strong>
      </header>
      {mode === 'matches' && selectedFamilyKey ? (
        <button type="button" className="rugby-explorer__clear" onClick={() => { onClearFamily?.(); closeDrawer?.(); }}>
          Ver todos los partidos
        </button>
      ) : null}
      <div className="rugby-explorer__list">
        {countries.map((country) => {
          const countryExpanded = expandedCountryCodes.has(country.code);
          return (
            <section className={`rugby-explorer__country${countryExpanded ? ' is-expanded' : ''}`} key={country.code}>
              <button
                type="button"
                className="rugby-explorer__country-btn"
                aria-expanded={countryExpanded}
                onClick={() => onCountrySelect(country.code)}
              >
                <span className="rugby-explorer__flag" aria-hidden="true">{country.flag}</span>
                <span className="rugby-explorer__country-name">{country.shortName}</span>
                <small>{country.unions.length} {country.unions.length === 1 ? 'organización' : 'organizaciones'}</small>
                <i aria-hidden="true">{countryExpanded ? '−' : '+'}</i>
              </button>
              {countryExpanded ? (
                <div className="rugby-explorer__unions">
                  {country.unions.map((union) => {
                    const unionExpanded = expandedUnionKeys.has(union.key);
                    return (
                      <section className={`rugby-explorer__item${unionExpanded ? ' is-expanded' : ''}`} key={union.key}>
                        <button
                          type="button"
                          className="rugby-explorer__union"
                          aria-expanded={unionExpanded}
                          onClick={() => onUnionSelect(union.key)}
                        >
                          <span title={union.label}>{union.shortLabel}</span>
                          <small>{union.families.length > 0 ? `${union.families.length} ${union.families.length === 1 ? 'torneo' : 'torneos'}` : 'Cobertura en preparación'}</small>
                          <i aria-hidden="true">{unionExpanded ? '−' : '+'}</i>
                        </button>
                        {unionExpanded ? (
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
        <span>Países y torneos</span><i aria-hidden="true">☰</i>
      </button>
      {drawerOpen ? (
        <div
          className="rugby-explorer-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={props.mode === 'matches' ? 'Países y partidos' : 'Países y torneos'}
          ref={drawerRef}
        >
          <header><strong>Países y torneos</strong><button type="button" aria-label="Cerrar explorador" onClick={closeDrawer}>×</button></header>
          <ExplorerNavigation {...props} closeDrawer={closeDrawer} />
        </div>
      ) : null}
    </>
  );
}
