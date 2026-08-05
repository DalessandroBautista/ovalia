import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { XvPath } from './xv-path';

describe('XvPath', () => {
  it('no revela el puesto antes de elegir una posición', () => {
    render(<XvPath onStartCareer={() => undefined} />);
    expect(screen.queryByText(/TU ROL/i)).toBeNull();
  });

  it('revela el puesto al tocar un lugar de la cancha', async () => {
    render(<XvPath onStartCareer={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'FB' }));
    expect(screen.getByText(/TU ROL/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fullback' })).toBeTruthy();
  });

  it('ofrece arrancar la carrera con el puesto elegido', async () => {
    const onStartCareer = vi.fn();
    render(<XvPath onStartCareer={onStartCareer} />);
    await userEvent.click(screen.getByRole('button', { name: 'FB' }));
    await userEvent.click(screen.getByRole('button', { name: /Arrancar la carrera/i }));
    expect(onStartCareer).toHaveBeenCalledWith('fullback');
  });
});
