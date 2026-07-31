import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GamesHub } from './games-hub';

describe('GamesHub', () => {
  it('muestra las tres tarjetas de juegos', () => {
    render(<GamesHub />);
    expect(screen.getByRole('button', { name: /Tu identidad ovalada/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Camino al XV/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Carrera de rugbier/i })).toBeTruthy();
  });

  it('abre la identidad ovalada desde el hub', async () => {
    render(<GamesHub />);
    await userEvent.click(screen.getByRole('button', { name: /Tu identidad ovalada/i }));
    expect(screen.getByText(/Con cinco minutos por jugar preferís/i)).toBeTruthy();
  });
});
