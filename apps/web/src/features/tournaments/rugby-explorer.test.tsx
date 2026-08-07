import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RugbyExplorer } from './rugby-explorer';
import type { RugbyExplorerCountry, RugbyExplorerUnion } from './rugby-explorer-data';

const urba: RugbyExplorerUnion = {
  key: 'urba',
  label: 'Unión de Rugby de Buenos Aires',
  shortLabel: 'URBA',
  families: [
    {
      key: 'top-14',
      title: 'TOP 14',
      priority: 100,
      canonicalSlug: 'urba-top-14',
      divisions: [],
    },
  ],
};

const uru: RugbyExplorerUnion = {
  key: 'uru',
  label: 'Unión de Rugby del Uruguay',
  shortLabel: 'URU',
  families: [
    {
      key: 'copa-uruguay',
      title: 'Copa Uruguay',
      priority: 50,
      canonicalSlug: 'uru-copa-uruguay',
      divisions: [],
    },
  ],
};

const countries: RugbyExplorerCountry[] = [
  {
    code: 'AR',
    name: 'Argentina',
    shortName: 'Argentina',
    flag: '\u{1F1E6}\u{1F1F7}',
    priority: 100,
    unions: [urba],
  },
  {
    code: 'UY',
    name: 'Uruguay',
    shortName: 'Uruguay',
    flag: '\u{1F1FA}\u{1F1FE}',
    priority: 90,
    unions: [uru],
  },
];

function renderExplorer({
  expandedCountryCodes = new Set(['AR']),
  expandedUnionKeys = new Set(['urba']),
  mode = 'catalog',
  onCountrySelect = () => {},
  onUnionSelect = () => {},
}: {
  expandedCountryCodes?: ReadonlySet<string>;
  expandedUnionKeys?: ReadonlySet<string>;
  mode?: 'catalog' | 'matches';
  onCountrySelect?: (countryCode: string) => void;
  onUnionSelect?: (unionKey: string) => void;
} = {}) {
  return render(
    <RugbyExplorer
      countries={countries}
      expandedCountryCodes={expandedCountryCodes}
      expandedUnionKeys={expandedUnionKeys}
      mode={mode}
      onCountrySelect={onCountrySelect}
      onUnionSelect={onUnionSelect}
    />,
  );
}

describe('RugbyExplorer accessible name', () => {
  it('uses a distinct accessible name for the catalog nav', () => {
    renderExplorer();
    expect(screen.getAllByRole('navigation')[0]).toHaveAccessibleName(/torneos/i);
  });

  it('uses a distinct accessible name for the matches nav, different from catalog', () => {
    const catalogRender = renderExplorer();
    const catalogLabel = catalogRender.getAllByRole('navigation')[0]!.getAttribute('aria-label');
    catalogRender.unmount();

    const matchesRender = renderExplorer({ mode: 'matches' });
    const matchesLabel = matchesRender.getAllByRole('navigation')[0]!.getAttribute('aria-label');
    matchesRender.unmount();

    expect(matchesLabel).not.toEqual(catalogLabel);
    expect(catalogLabel).toMatch(/torneos/i);
    expect(matchesLabel).toMatch(/partidos/i);
  });
});

describe('RugbyExplorer expansión con Sets', () => {
  it('expande solo los países incluidos en el set', () => {
    renderExplorer({ expandedCountryCodes: new Set(['AR']), expandedUnionKeys: new Set(['urba']) });
    expect(screen.getByRole('button', { name: /argentina/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /uruguay/i })).toHaveAttribute('aria-expanded', 'false');
    // Solo se muestran las uniones del país expandido
    expect(screen.getByText('URBA')).toBeInTheDocument();
    expect(screen.queryByText('URU')).not.toBeInTheDocument();
  });

  it('soporta múltiples países y uniones expandidos a la vez', () => {
    renderExplorer({ expandedCountryCodes: new Set(['AR', 'UY']), expandedUnionKeys: new Set(['urba', 'uru']) });
    expect(screen.getByRole('button', { name: /argentina/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /uruguay/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('URBA')).toBeInTheDocument();
    expect(screen.getByText('URU')).toBeInTheDocument();
  });

  it('colapsa el país cuando el click lo saca del set de expandidos', async () => {
    const user = userEvent.setup();
    const onCountrySelect = vi.fn();
    const { rerender } = renderExplorer({ onCountrySelect });
    expect(screen.getByText('URBA')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /argentina/i }));
    expect(onCountrySelect).toHaveBeenCalledWith('AR');

    rerender(
      <RugbyExplorer
        countries={countries}
        expandedCountryCodes={new Set()}
        expandedUnionKeys={new Set()}
        mode="catalog"
        onCountrySelect={onCountrySelect}
        onUnionSelect={() => {}}
      />,
    );
    expect(screen.queryByText('URBA')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /argentina/i })).toHaveAttribute('aria-expanded', 'false');
  });

  it('expande el país cuando el click lo agrega al set de expandidos', async () => {
    const user = userEvent.setup();
    const onCountrySelect = vi.fn();
    const { rerender } = renderExplorer({ expandedCountryCodes: new Set(), expandedUnionKeys: new Set(), onCountrySelect });
    expect(screen.queryByText('URBA')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /argentina/i }));
    expect(onCountrySelect).toHaveBeenCalledWith('AR');

    rerender(
      <RugbyExplorer
        countries={countries}
        expandedCountryCodes={new Set(['AR'])}
        expandedUnionKeys={new Set(['urba'])}
        mode="catalog"
        onCountrySelect={onCountrySelect}
        onUnionSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /argentina/i })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('URBA')).toBeInTheDocument();
  });
});

describe('RugbyExplorer mobile drawer', () => {
  function setup(mode: 'catalog' | 'matches' = 'catalog') {
    return renderExplorer({ mode });
  }

  it('opens the drawer as a labeled dialog when the trigger button is clicked', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /países y torneos/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName();
  });

  it('closes the drawer on Escape, restoring focus to the trigger', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /países y torneos/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the drawer via its explicit close control', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /países y torneos/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    const closeButton = within(dialog).getByRole('button', { name: /cerrar/i });

    await user.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('blocks body scroll while open and restores it on close', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /países y torneos/i });
    expect(document.body.style.overflow).not.toBe('hidden');

    await user.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /países y torneos/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});
