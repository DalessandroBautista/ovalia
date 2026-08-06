'use client';

import { useCallback, useState } from 'react';

import {
  fetchAdminConflicts,
  fetchAdminSummary,
  resolveAdminConflict,
  type AdminConflict,
  type AdminSummary,
} from '../../lib/api/client';
import { PortalHeader } from '../portal/portal-pages';

export function AdminPage() {
  // El token se mantiene solo en memoria: no se persiste (evita exfiltración por XSS).
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [conflicts, setConflicts] = useState<AdminConflict[]>([]);

  const load = useCallback(async (t: string) => {
    setError(null);
    try {
      const [s, c] = await Promise.all([fetchAdminSummary(t), fetchAdminConflicts(t)]);
      setSummary(s);
      setConflicts(c.conflicts);
      setAuthed(true);
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

  const dismissVisible = async () => {
    setError(null);
    try {
      // Cada resolución conserva su propia entrada de auditoría en la API.
      for (const conflict of conflicts) {
        await resolveAdminConflict(token, conflict.id, 'dismissed');
      }
      setConflicts([]);
      setSummary((prev) => (prev ? { ...prev, openConflicts: 0 } : prev));
    } catch {
      setError('La limpieza se interrumpió. Recargá la cola para ver qué conflictos siguen abiertos.');
      await load(token);
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
            <nav className="admin-nav">
              <a href="/admin/lineups">Cargar formaciones</a>
              <a href="/admin/importar-csv">Importar partidos (CSV)</a>
            </nav>
            <div className="admin-grid">
              <section><small>CONFLICTOS</small><strong>{summary?.openConflicts ?? 0}</strong><span>en cuarentena</span></section>
              <section><small>INGESTIÓN</small><strong>{summary?.failedRuns ?? 0}</strong><span>corridas fallidas</span></section>
              <section><small>EDITORIAL</small><strong>{summary?.pendingDrafts ?? 0}</strong><span>borradores por revisar</span></section>
            </div>
            <section className="review-queue">
              <h2>Cola de conflictos</h2>
              {conflicts.length > 1 ? (
                <button type="button" onClick={() => void dismissVisible()}>
                  Descartar los {conflicts.length} visibles
                </button>
              ) : null}
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
