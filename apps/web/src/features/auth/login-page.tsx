'use client';

import { useState, type FormEvent } from 'react';
import { login, register } from '../../lib/api/client';
import { PortalHeader } from '../portal/portal-pages';

type Mode = 'login' | 'register';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('sending');
    setMessage('');
    try {
      if (mode === 'register') {
        if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
        const response = await register(email, displayName, password);
        setMessage(`Sesión iniciada como ${response.user.displayName}`);
      } else {
        const response = await login(email, password);
        setMessage(`Sesión iniciada como ${response.user.displayName}`);
      }
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No pudimos iniciar sesión.');
    }
  };

  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main auth-main">
        <section className="auth-card">
          <p className="eyebrow">TU CUENTA</p>
          <h1>{mode === 'login' ? 'Ingresar a Ovalia' : 'Crear cuenta'}</h1>
          <p>{mode === 'login' ? 'Guardá tus prodes y seguí tu rugby.' : 'Una cuenta para tus pronósticos y tu perfil ovalado.'}</p>
          <form onSubmit={submit}>
            {mode === 'register' ? (
              <label>Nombre visible<input aria-label="Nombre visible" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
            ) : null}
            <label>Email<input aria-label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label>Contraseña<input aria-label="Contraseña" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
            {mode === 'register' ? (
              <label>Repetir contraseña<input aria-label="Repetir contraseña" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required /></label>
            ) : null}
            <button className="primary-action" type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
          </form>
          {message ? <p className={status === 'error' ? 'portal-live-status portal-live-status--error' : 'portal-live-status'}>{message}</p> : null}
          <button className="auth-switch" type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setStatus('idle'); setMessage(''); }}>
            {mode === 'login' ? '¿Todavía no tenés cuenta? Crear una' : 'Ya tengo una cuenta'}
          </button>
        </section>
      </main>
    </div>
  );
}
