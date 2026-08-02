import { LoginPage as LoginPanel } from '../../src/features/auth/login-page';

export const metadata = {
  title: 'Ingresar — Ovalia',
  description: 'Cuentas de Ovalia: prodes, favoritos y rankings.',
};

export default function LoginPage() {
  return <LoginPanel />;
}
