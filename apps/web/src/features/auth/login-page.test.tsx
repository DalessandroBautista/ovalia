import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './login-page';

const login = vi.fn();
const register = vi.fn();

vi.mock('../../lib/api/client', () => ({
  login: (...args: unknown[]) => login(...args),
  register: (...args: unknown[]) => register(...args),
}));

describe('login page', () => {
  beforeEach(() => {
    login.mockReset().mockResolvedValue({ user: { displayName: 'Persona' } });
    register.mockReset().mockResolvedValue({ user: { displayName: 'Persona' } });
  });

  it('permite iniciar sesión y muestra el estado autenticado', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText('Email'), 'persona@example.test');
    await user.type(screen.getByLabelText('Contraseña'), 'clave-segura');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(login).toHaveBeenCalledWith('persona@example.test', 'clave-segura');
    expect(await screen.findByText('Sesión iniciada como Persona')).toBeTruthy();
  });
});
