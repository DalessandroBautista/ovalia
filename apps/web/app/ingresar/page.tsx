import { PortalHeader } from '../../src/features/portal/portal-pages';

export const metadata = {
  title: 'Ingresar — Ovalia',
  description: 'Cuentas de Ovalia: prodes, favoritos y rankings.',
};

export default function LoginPage() {
  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main auth-main">
        <section className="auth-card">
          <p className="eyebrow">TU CUENTA</p>
          <h1>Ingresar a Ovalia</h1>
          <p>Las cuentas están en camino. Vas a poder guardar prodes, seguir equipos y participar de rankings.</p>
          <p className="portal-live-status">El registro y el ingreso estarán disponibles en la próxima actualización.</p>
        </section>
      </main>
    </div>
  );
}
