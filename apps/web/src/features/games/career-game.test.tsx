import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_CATALOG } from '@ovalia/domain';
import { CareerGame } from './career-game';

vi.mock('./use-career-clubs', () => ({
  useCareerClubs: () => ({ clubs: FALLBACK_CATALOG.clubs, loading: false }),
}));

describe('CareerGame', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('permite crear el jugador: apellido, club y posición', async () => {
    render(<CareerGame />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    expect(screen.getByText(/Pérez/i)).toBeTruthy();
  });

  it('avanza la temporada y muestra las decisiones del escenario', async () => {
    render(<CareerGame />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    // El primer escenario ofrece al menos dos opciones.
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getAllByRole('button')[0]!);
    // El historial muestra la temporada jugada.
    expect(screen.getByText(/Temporada 1/i)).toBeTruthy();
  });

  it('cierra con tarjeta, puntaje y comparación', async () => {
    render(<CareerGame initialSeed={123} />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    // Se avanza eligiendo la primera opción hasta el retiro (tope de iteraciones).
    const tier = /^(Ídolo eterno del club|Gloria amateur|Corazón rugbier|Leyenda|Profesional)$/i;
    for (let i = 0; i < 60 && !screen.queryByText(tier); i += 1) {
      const firstButton = screen.getAllByRole('button')[0];
      if (!firstButton) break;
      await userEvent.click(firstButton);
    }
    expect(screen.getByText(tier)).toBeTruthy();
    expect(screen.getByText(/Tu carrera se parece/i)).toBeTruthy();
  });
});
