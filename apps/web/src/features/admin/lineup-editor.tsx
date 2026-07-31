'use client';

import { useCallback, useMemo, useState } from 'react';

import { parseLineupText } from '@ovalia/domain';
import { fetchPlayersSearch, saveMatchLineup } from '../../lib/api/client';
import type { ApiPlayer } from '../../lib/api/types';
import { PortalHeader } from '../portal/portal-pages';

type Side = 'home' | 'away';

interface ResolvedEntry {
  side: Side;
  shirtNumber: number;
  name: string;
  isStarter: boolean;
  isCaptain: boolean;
  playerId: string | null;
  candidates: ApiPlayer[];
  status: 'pending' | 'resolved';
}

const candidateKey = (side: Side, shirtNumber: number) => `${side}:${shirtNumber}`;

export function LineupEditor() {
  // Paso 0: token.
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);

  // Paso 1: partido.
  const [matchId, setMatchId] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');

  // Paso 2: texto pegado.
  const [homeText, setHomeText] = useState('');
  const [awayText, setAwayText] = useState('');
  const [previewHome, setPreviewHome] = useState<{ entries: Array<{ shirtNumber: number; name: string; isStarter: boolean; isCaptain: boolean }>; warnings: string[] } | null>(null);
  const [previewAway, setPreviewAway] = useState<{ entries: Array<{ shirtNumber: number; name: string; isStarter: boolean; isCaptain: boolean }>; warnings: string[] } | null>(null);

  // Paso 3: resolución.
  const [entries, setEntries] = useState<ResolvedEntry[]>([]);
  const [resolving, setResolving] = useState(false);

  // Paso 4: guardar.
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewTeam = useCallback((side: Side) => {
    const text = side === 'home' ? homeText : awayText;
    const parsed = parseLineupText(text);
    const summary = {
      entries: parsed.entries.map((e) => ({
        shirtNumber: e.shirtNumber,
        name: e.name,
        isStarter: e.isStarter,
        isCaptain: e.isCaptain,
      })),
      warnings: parsed.warnings,
    };
    if (side === 'home') setPreviewHome(summary);
    else setPreviewAway(summary);
  }, [homeText, awayText]);

  const collectForResolution = useCallback((side: Side, preview: typeof previewHome) => {
    if (!preview) return [];
    return preview.entries.map((e) => ({
      side,
      shirtNumber: e.shirtNumber,
      name: e.name,
      isStarter: e.isStarter,
      isCaptain: e.isCaptain,
    }));
  }, []);

  const resolveAll = useCallback(async () => {
    if ((!previewHome || previewHome.entries.length === 0) && (!previewAway || previewAway.entries.length === 0)) return;
    setResolving(true);
    setError(null);
    try {
      const homeEntries = collectForResolution('home', previewHome);
      const awayEntries = collectForResolution('away', previewAway);
      const all = [...homeEntries, ...awayEntries];

      const resolved: ResolvedEntry[] = [];
      const seen = new Set<string>();
      for (const entry of all) {
        const key = candidateKey(entry.side, entry.shirtNumber);
        if (seen.has(key)) continue;
        seen.add(key);
        let candidates: ApiPlayer[] = [];
        try {
          const search = await fetchPlayersSearch(entry.name);
          candidates = search.players;
        } catch {
          candidates = [];
        }
        const soloMatch = candidates.length === 1 ? candidates[0] ?? null : null;
        resolved.push({
          ...entry,
          playerId: soloMatch?.id ?? null,
          candidates,
          status: soloMatch ? 'resolved' : 'pending',
        });
      }
      setEntries(resolved);
    } catch {
      setError('Error al buscar jugadores. Revisá la conexión con la API.');
    } finally {
      setResolving(false);
    }
  }, [previewHome, previewAway, collectForResolution]);

  const selectCandidate = useCallback((side: Side, shirtNumber: number, playerId: string) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.side === side && entry.shirtNumber === shirtNumber
          ? { ...entry, playerId, status: 'resolved' }
          : entry,
      ),
    );
  }, []);

  const selectNewPlayer = useCallback((side: Side, shirtNumber: number) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.side === side && entry.shirtNumber === shirtNumber
          ? { ...entry, playerId: null, status: 'resolved' }
          : entry,
      ),
    );
  }, []);

  const pendingCount = useMemo(
    () => entries.filter((e) => e.status === 'pending').length,
    [entries],
  );

  const confirmSave = useCallback(async () => {
    if (!matchId || !token) return;
    setSaving(true);
    setError(null);
    try {
      const bySide = (side: Side) =>
        entries
          .filter((e) => e.side === side)
          .map((e) => ({
            shirtNumber: e.shirtNumber,
            name: e.name,
            isCaptain: e.isCaptain,
            playerId: e.playerId,
          }));

      if (bySide('home').length > 0) {
        await saveMatchLineup(token, matchId, 'home', bySide('home'));
      }
      if (bySide('away').length > 0) {
        await saveMatchLineup(token, matchId, 'away', bySide('away'));
      }
      setSuccess(`Formaciones guardadas para ${homeTeam} vs ${awayTeam}`);
      setEntries([]);
      setPreviewHome(null);
      setPreviewAway(null);
      setHomeText('');
      setAwayText('');
    } catch {
      setError('Error al guardar. Verificá el token y la conexión.');
    } finally {
      setSaving(false);
    }
  }, [matchId, token, entries, homeTeam, awayTeam]);

  const resetAll = useCallback(() => {
    setMatchId('');
    setHomeTeam('');
    setAwayTeam('');
    setHomeText('');
    setAwayText('');
    setPreviewHome(null);
    setPreviewAway(null);
    setEntries([]);
    setError(null);
    setSuccess(null);
  }, []);

  if (!authed) {
    return (
      <div className="portal-shell">
        <PortalHeader />
        <main className="portal-main">
          <p className="eyebrow">OPERACIÓN · CARGA DE FORMACIONES</p>
          <h1>Editor de formaciones</h1>
          <p className="portal-intro">Cargá los planteles de los equipos pegando el texto de la formación.</p>

          <section className="auth-card">
            <label htmlFor="lineup-token">Token de admin</label>
            <input
              id="lineup-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button className="primary-action" type="button" onClick={() => setAuthed(true)}>
              Ingresar
            </button>
            {error ? <p className="portal-live-status portal-live-status--error">{error}</p> : null}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main">
        <p className="eyebrow">OPERACIÓN · CARGA DE FORMACIONES</p>
        <h1>Editor de formaciones</h1>

        {!matchId ? (
          <section className="auth-card">
            <h3>Partido</h3>
            <label htmlFor="lineup-match">ID del partido (UUID)</label>
            <input
              id="lineup-match"
              type="text"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
            <label htmlFor="lineup-home">Equipo local</label>
            <input id="lineup-home" type="text" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Ej: Hindú" />
            <label htmlFor="lineup-away">Equipo visitante</label>
            <input id="lineup-away" type="text" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Ej: SIC" />
            <button
              className="primary-action"
              type="button"
              onClick={() => setError(null)}
              disabled={!matchId || !homeTeam || !awayTeam}
            >
              Continuar
            </button>
            <button type="button" className="secondary-action" onClick={resetAll}>Volver</button>
          </section>
        ) : (
          <>
            <p className="portal-intro">
              {homeTeam} vs {awayTeam}
            </p>

            {success ? (
              <section className="auth-card">
                <p className="portal-live-status">{success}</p>
                <button className="primary-action" type="button" onClick={resetAll}>
                  Cargar otro partido
                </button>
              </section>
            ) : null}

            {!success && entries.length === 0 ? (
              <>
                <div className="lineup-editor__grid">
                  <section>
                    <h3>Local: {homeTeam}</h3>
                    <label htmlFor="lineup-home-text">Pegá la formación (un jugador por línea)</label>
                    <textarea
                      id="lineup-home-text"
                      className="lineup-editor__textarea"
                      rows={10}
                      value={homeText}
                      onChange={(e) => setHomeText(e.target.value)}
                      placeholder={'1. Marcos Torrillas (c)\n2. Juan Cruz Pérez\n…'}
                    />
                    <button className="primary-action" type="button" onClick={() => previewTeam('home')} disabled={!homeText.trim()}>
                      Previsualizar
                    </button>
                    {previewHome?.warnings.map((w, i) => (
                      <p key={i} className="portal-live-status portal-live-status--error">{w}</p>
                    ))}
                    {previewHome && previewHome.entries.length > 0 ? (
                      <div className="lineup-preview">
                        <small>{previewHome.entries.filter((e) => e.isStarter).length} titulares · {previewHome.entries.filter((e) => !e.isStarter).length} suplentes</small>
                        <ol>
                          {previewHome.entries.map((e) => (
                            <li key={e.shirtNumber}>
                              <span className="lineup-preview__number">{e.shirtNumber}</span>
                              <span>{e.name}{e.isCaptain ? ' ©' : ''}</span>
                              <span className="lineup-preview__role">{e.isStarter ? 'Titular' : 'Suplente'}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </section>

                  <section>
                    <h3>Visitante: {awayTeam}</h3>
                    <label htmlFor="lineup-away-text">Pegá la formación (un jugador por línea)</label>
                    <textarea
                      id="lineup-away-text"
                      className="lineup-editor__textarea"
                      rows={10}
                      value={awayText}
                      onChange={(e) => setAwayText(e.target.value)}
                      placeholder={'1. Nicolás Sánchez (c)\n2. Pedro Rodríguez\n…'}
                    />
                    <button className="primary-action" type="button" onClick={() => previewTeam('away')} disabled={!awayText.trim()}>
                      Previsualizar
                    </button>
                    {previewAway?.warnings.map((w, i) => (
                      <p key={i} className="portal-live-status portal-live-status--error">{w}</p>
                    ))}
                    {previewAway && previewAway.entries.length > 0 ? (
                      <div className="lineup-preview">
                        <small>{previewAway.entries.filter((e) => e.isStarter).length} titulares · {previewAway.entries.filter((e) => !e.isStarter).length} suplentes</small>
                        <ol>
                          {previewAway.entries.map((e) => (
                            <li key={e.shirtNumber}>
                              <span className="lineup-preview__number">{e.shirtNumber}</span>
                              <span>{e.name}{e.isCaptain ? ' ©' : ''}</span>
                              <span className="lineup-preview__role">{e.isStarter ? 'Titular' : 'Suplente'}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                  </section>
                </div>

                <div className="lineup-editor__actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={resolveAll}
                    disabled={resolving || ((!previewHome || previewHome.entries.length === 0) && (!previewAway || previewAway.entries.length === 0))}
                  >
                    {resolving ? 'Buscando jugadores…' : 'Buscar jugadores y revisar'}
                  </button>
                  <button type="button" className="secondary-action" onClick={resetAll}>Cambiar partido</button>
                </div>
              </>
            ) : null}

            {!success && entries.length > 0 ? (
              <>
                <h3 className="lineup-editor__section-title">Revisar jugadores</h3>
                <p className="portal-intro">
                  {pendingCount > 0
                    ? `${pendingCount} jugador(es) sin coincidencia exacta. Elegí un jugador existente o creá uno nuevo.`
                    : 'Todos los jugadores se resolvieron automáticamente.'}
                </p>

                <div className="lineup-editor__grid">
                  {(['home', 'away'] as Side[]).map((side) => {
                    const teamName = side === 'home' ? homeTeam : awayTeam;
                    const teamEntries = entries.filter((e) => e.side === side);
                    if (teamEntries.length === 0) return null;
                    return (
                      <section key={side}>
                        <h3>{side === 'home' ? 'Local' : 'Visitante'}: {teamName}</h3>
                        <div className="lineup-preview">
                          <ol>
                            {teamEntries.map((e) => (
                              <li key={e.shirtNumber} className="lineup-preview__row">
                                <span className="lineup-preview__number">{e.shirtNumber}</span>
                                <span className="lineup-preview__name">
                                  {e.name}{e.isCaptain ? ' ©' : ''}
                                </span>
                                <span className="lineup-preview__role">{e.isStarter ? 'Titular' : 'Suplente'}</span>
                                <span className="lineup-preview__select-wrap">
                                  {e.status === 'pending' ? (
                                    <select
                                      aria-label={`Jugador para ${e.name}`}
                                      defaultValue=""
                                      onChange={(ev) => {
                                        if (ev.target.value === '__new__') selectNewPlayer(e.side, e.shirtNumber);
                                        else selectCandidate(e.side, e.shirtNumber, ev.target.value);
                                      }}
                                    >
                                      <option value="" disabled>Elegí…</option>
                                      {e.candidates.map((p) => (
                                        <option key={p.id} value={p.id}>{p.fullName}</option>
                                      ))}
                                      <option value="__new__">Crear nuevo jugador</option>
                                    </select>
                                  ) : (
                                    <span className="lineup-preview__resolved">
                                      {e.playerId
                                        ? (e.candidates.find((c) => c.id === e.playerId)?.fullName ?? 'Existente')
                                        : 'Nuevo'}
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </section>
                    );
                  })}
                </div>

                <div className="lineup-editor__actions">
                  <button
                    className="primary-action"
                    type="button"
                    onClick={confirmSave}
                    disabled={saving || pendingCount > 0}
                  >
                    {saving ? 'Guardando…' : 'Confirmar y guardar'}
                  </button>
                  <button type="button" className="secondary-action" onClick={() => { setEntries([]); setPreviewHome(null); setPreviewAway(null); }}>
                    Volver al texto
                  </button>
                </div>
              </>
            ) : null}

            {error ? <p className="portal-live-status portal-live-status--error">{error}</p> : null}
          </>
        )}
      </main>
    </div>
  );
}
