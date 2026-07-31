import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { XvPath } from './xv-path';

describe('XvPath', () => {
  it('no revela el puesto antes de confirmar', () => {
    render(<XvPath onStartCareer={() => undefined} />);
    expect(screen.queryByText(/TU ROL/i)).toBeNull();
  });

  it('revela el puesto al confirmar', async () => {
    render(<XvPath onStartCareer={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Descubrí tu puesto/i }));
    expect(screen.getByText(/TU ROL/i)).toBeTruthy();
  });

  it('ofrece arrancar la carrera con el puesto elegido', async () => {
    const onStartCareer = vi.fn();
    render(<XvPath onStartCareer={onStartCareer} />);
    await userEvent.click(screen.getByRole('button', { name: /Descubrí tu puesto/i }));
    await userEvent.click(screen.getByRole('button', { name: /Arrancar la carrera/i }));
    expect(onStartCareer).toHaveBeenCalled();
  });
});
