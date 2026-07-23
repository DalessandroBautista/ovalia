import { PortalHeader } from '../../src/features/portal/portal-pages';

export default function LoginPage() {
  return <div className="portal-shell"><PortalHeader /><main className="portal-main auth-main"><section className="auth-card"><p className="eyebrow">TU CUENTA</p><h1>Ingresar a Ovalia</h1><p>Guardá tus prodes, seguí equipos y participá de rankings.</p><button>Continuar con Google</button><span>o</span><label>Email<input type="email" placeholder="vos@ejemplo.com" /></label><label>Contraseña<input type="password" /></label><button className="primary-action">Ingresar</button><a href="#">¿Olvidaste tu contraseña?</a></section></main></div>;
}
