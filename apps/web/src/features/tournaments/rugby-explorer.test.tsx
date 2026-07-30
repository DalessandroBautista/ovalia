import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RugbyExplorer } from './rugby-explorer';
import type { RugbyExplorerUnion } from './rugby-explorer-data';

const unions: RugbyExplorerUnion[] = [
  {
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
  },
];

describe('RugbyExplorer accessible name', () => {
  it('uses a distinct accessible name for the catalog nav', () => {
    render(
      <RugbyExplorer
        unions={unions}
        expandedUnionKey="urba"
        mode="catalog"
        onUnionSelect={() => {}}
      />,
    );
    expect(screen.getAllByRole('navigation')[0]).toHaveAccessibleName(/torneos/i);
  });

  it('uses a distinct accessible name for the matches nav, different from catalog', () => {
    const catalogRender = render(
      <RugbyExplorer unions={unions} expandedUnionKey="urba" mode="catalog" onUnionSelect={() => {}} />,
    );
    const catalogLabel = catalogRender.getAllByRole('navigation')[0]!.getAttribute('aria-label');
    catalogRender.unmount();

    const matchesRender = render(
      <RugbyExplorer unions={unions} expandedUnionKey="urba" mode="matches" onUnionSelect={() => {}} />,
    );
    const matchesLabel = matchesRender.getAllByRole('navigation')[0]!.getAttribute('aria-label');
    matchesRender.unmount();

    expect(matchesLabel).not.toEqual(catalogLabel);
    expect(catalogLabel).toMatch(/torneos/i);
    expect(matchesLabel).toMatch(/partidos/i);
  });
});

describe('RugbyExplorer mobile drawer', () => {
  function setup(mode: 'catalog' | 'matches' = 'catalog') {
    return render(
      <RugbyExplorer
        unions={unions}
        expandedUnionKey="urba"
        mode={mode}
        onUnionSelect={() => {}}
      />,
    );
  }

  it('opens the drawer as a labeled dialog when the trigger button is clicked', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /uniones y torneos/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName();
  });

  it('closes the drawer on Escape, restoring focus to the trigger', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /uniones y torneos/i });
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes the drawer via its explicit close control', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /uniones y torneos/i });
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
    const trigger = screen.getByRole('button', { name: /uniones y torneos/i });
    expect(document.body.style.overflow).not.toBe('hidden');

    await user.click(trigger);
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    setup();
    const trigger = screen.getByRole('button', { name: /uniones y torneos/i });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});
