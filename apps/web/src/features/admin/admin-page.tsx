'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  fetchAdminConflicts,
  fetchAdminSummary,
  resolveAdminConflict,
  type AdminConflict,
  type AdminSummary,
} from '../../lib/api/client';
import { PortalHeader } from '../portal/portal-pages';

const TOKEN_KEY = 'ovalia_admin_token';

export function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [conflicts, setConflicts] = useState<AdminConflict[]>([]);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null;
    if (stored) setToken(stored);
  }, []);

  const load = useCallback(async (t: string) => {
    setError(null);
    try {
      const [s, c] = await Promise.all([fetchAdminSummary(t), fetchAdminConflicts(t)]);
      setSummary(s);
      setConflicts(c.conflicts);
      setAuthed(true);
      window.localStorage.setItem(TOKEN_KEY, t);
    } catch {
      setAuthed(false);
      setError('Token inválido o admin deshabilitado.');
    }
  }, []);

  const dismiss = async (id: string) => {
    try {
      await resolveAdminConflict(token, id, 'dismissed');
      setConflicts((prev) => prev.filter((c) => c.id !== id));
      setSummary((prev) => (prev ? { ...prev, openConflicts: Math.max(0, prev.openConflicts - 1) } : prev));
    } catch {
      setError('No se pudo resolver el conflicto.');
    }
  };

  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main">
        <p className="eyebrow">OPERACIÓN · ACCESO EDITOR</p>
        <h1>Mesa de control</h1>
        <p className="portal-intro">Estado de datos e ingestión, y conflictos pendientes de resolución.</p>

        {!authed ? (
          <section className="auth-card">
            <label>Token de admin
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
            <button className="primary-action" type="button" onClick={() => void load(token)}>Ingresar</button>
            {error ? <p className="portal-live-status portal-live-status--error">{error}</p> : null}
          </section>
        ) : (
          <>
            <div className="admin-grid">
              <section><small>CONFLICTOS</small><strong>{summary?.openConflicts ?? 0}</strong><span>en cuarentena</span></section>
              <section><small>INGESTIÓN</small><strong>{summary?.failedRuns ?? 0}</strong><span>corridas fallidas</span></section>
              <section><small>EDITORIAL</small><strong>{summary?.pendingDrafts ?? 0}</strong><span>borradores por revisar</span></section>
            </div>
            <section className="review-queue">
              <h2>Cola de conflictos</h2>
              {conflicts.length === 0 ? <p className="portal-live-status">No hay conflictos abiertos.</p> : null}
              {conflicts.map((c) => (
                <article key={c.id}>
                  <div>
                    <small>{c.entityType.toUpperCase()}</small>
                    <h3>{c.reason ?? 'Conflicto sin resolver'}</h3>
                    <pre className="conflict-raw">{JSON.stringify(c.candidates, null, 2).slice(0, 400)}</pre>
                  </div>
                  <button type="button" onClick={() => void dismiss(c.id)}>Descartar</button>
                </article>
              ))}
            </section>
            {error ? <p className="portal-live-status portal-live-status--error">{error}</p> : null}
          </>
        )}
      </main>
    </div>
  );
}
