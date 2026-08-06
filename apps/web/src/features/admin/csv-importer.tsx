'use client';

import { useState } from 'react';
import { useCompetitions } from '../tournaments/use-tournaments';
import { PortalHeader } from '../portal/portal-pages';
import { ingestMatchesCsv, type ApiCsvImportReport } from '../../lib/api/client';

export function CsvImporter() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);

  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [report, setReport] = useState<ApiCsvImportReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { status: compStatus, competitions } = useCompetitions();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setCsvContent(text);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    if (!token || !selectedCompetition || !csvContent) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await ingestMatchesCsv(token, selectedCompetition, csvContent, true);
      setReport(result);
    } catch (err: any) {
      setError(err?.message || 'Error al validar el archivo CSV.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!token || !selectedCompetition || !csvContent) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await ingestMatchesCsv(token, selectedCompetition, csvContent, false);
      setSuccess(`Importación exitosa: se persistieron ${result.persisted} partidos.`);
      setReport(null);
      setCsvContent('');
    } catch (err: any) {
      setError(err?.message || 'Error al confirmar la importación.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setReport(null);
    setError(null);
  };

  const handleReset = () => {
    setReport(null);
    setCsvContent('');
    setSelectedCompetition('');
    setError(null);
    setSuccess(null);
  };

  if (!authed) {
    return (
      <div className="portal-shell">
        <PortalHeader />
        <main className="portal-main">
          <p className="eyebrow">OPERACIÓN · IMPORTAR PARTIDOS VIA CSV</p>
          <h1>Importar partidos (CSV)</h1>
          <p className="portal-intro">Acceso exclusivo para administradores y uniones provinciales.</p>

          <section className="auth-card">
            <label htmlFor="csv-token">Token de admin</label>
            <input
              id="csv-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Ingrese el token de seguridad"
              style={{
                width: '100%',
                padding: '12px',
                color: 'var(--paper)',
                background: '#0b150f',
                border: '1px solid var(--line)',
                marginBottom: '16px'
              }}
            />
            <button className="primary-action" type="button" onClick={() => setAuthed(true)}>
              Ingresar
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main">
        <p className="eyebrow">OPERACIÓN · IMPORTAR PARTIDOS VIA CSV</p>
        <h1>Importador manual de partidos</h1>

        <nav className="admin-nav">
          <a href="/admin">Volver a Mesa de control</a>
          <a href="/admin/lineups">Cargar formaciones</a>
        </nav>

        {success ? (
          <section className="auth-card" style={{ borderLeft: '4px solid var(--lime)' }}>
            <p className="portal-live-status" style={{ color: 'var(--lime)', fontWeight: 'bold' }}>{success}</p>
            <button className="primary-action" type="button" onClick={handleReset}>
              Importar otro archivo
            </button>
          </section>
        ) : null}

        {error ? (
          <section className="auth-card" style={{ borderLeft: '4px solid #ff4a4a' }}>
            <p className="portal-live-status portal-live-status--error" style={{ margin: 0 }}>{error}</p>
          </section>
        ) : null}

        {!success && !report ? (
          <section className="auth-card">
            <h3>1. Configurar Importación</h3>

            <label htmlFor="csv-competition">Competencia / Unión Destino</label>
            <div className="lineup-preview__select-wrap" style={{ margin: '8px 0 20px' }}>
              {compStatus === 'loading' && <p>Cargando competencias...</p>}
              {compStatus === 'error' && <p style={{ color: 'red' }}>Error al cargar competencias.</p>}
              {compStatus === 'ready' && (
                <select
                  id="csv-competition"
                  value={selectedCompetition}
                  onChange={(e) => setSelectedCompetition(e.target.value)}
                >
                  <option value="">-- Seleccionar competencia --</option>
                  {competitions.map((comp) => (
                    <option key={comp.slug} value={comp.slug}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <label htmlFor="csv-file-upload" style={{ display: 'block', marginTop: '16px' }}>Subir archivo CSV (.csv)</label>
            <input
              id="csv-file-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{
                display: 'block',
                margin: '8px 0 20px',
                padding: '12px',
                background: '#0b150f',
                border: '1px dashed var(--line)',
                color: 'var(--paper)',
                width: '100%',
                cursor: 'pointer'
              }}
            />

            <label htmlFor="csv-text-paste">O pegar contenido del CSV</label>
            <textarea
              id="csv-text-paste"
              className="lineup-editor__textarea"
              rows={12}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="competition_slug,season_year,round,starts_at,home_team,away_team,status,home_score,away_score&#10;liga-x,2026,Fecha 1,2026-08-01T15:00:00-03:00,SIC,CASI,final,20,17"
              style={{ fontFamily: 'monospace', fontSize: '11px', marginTop: '8px' }}
            />

            <div className="lineup-editor__actions" style={{ marginTop: '20px' }}>
              <button
                className="primary-action"
                type="button"
                onClick={handlePreview}
                disabled={loading || !selectedCompetition || !csvContent.trim()}
              >
                {loading ? 'Procesando...' : 'Previsualizar e Importar'}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={handleReset}
                disabled={loading}
              >
                Limpiar
              </button>
            </div>
          </section>
        ) : null}

        {report && !success ? (
          <section className="auth-card">
            <h3>2. Previsualización y Validación</h3>

            <div className="admin-grid" style={{ margin: '16px 0', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              <section>
                <small>FILAS LEÍDAS</small>
                <strong>{report.totalRows}</strong>
              </section>
              <section>
                <small>A PERSISTIR (VÁLIDOS)</small>
                <strong style={{ color: 'var(--lime)' }}>{report.persisted}</strong>
              </section>
              <section>
                <small>CONFLICTOS (EQUIPO)</small>
                <strong style={{ color: report.conflicts > 0 ? '#ffae19' : 'inherit' }}>{report.conflicts}</strong>
              </section>
              <section>
                <small>ERRORES</small>
                <strong style={{ color: report.errors.length > 0 ? '#ff4a4a' : 'inherit' }}>{report.errors.length}</strong>
              </section>
            </div>

            {report.conflicts > 0 ? (
              <div style={{
                background: 'rgba(255, 174, 25, 0.1)',
                border: '1px solid #ffae19',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '13px'
              }}>
                <strong style={{ color: '#ffae19' }}>Aviso de conflictos de equipo: </strong>
                {report.conflicts} filas contienen nombres de equipo que no pudimos resolver de forma unívoca. Se crearán registros de conflicto en la Mesa de Control para resolución manual, sin bloquear la importación del resto de las filas.
              </div>
            ) : null}

            {report.errors.length > 0 ? (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#ff4a4a', margin: '0 0 8px' }}>Errores de parsing por fila (se ignorarán):</h4>
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  background: '#0b150f',
                  border: '1px solid var(--line)',
                  padding: '10px'
                }}>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#e8ece9', fontSize: '12px', fontFamily: 'monospace' }}>
                    {report.errors.map((err, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>
                        Línea {err.line}: <span style={{ color: '#ff7c7c' }}>{err.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {report.persisted > 0 ? (
              <p style={{ fontSize: '14px', color: '#c5d0c8', marginBottom: '20px' }}>
                Se detectaron <strong>{report.persisted}</strong> partidos listos para importar. ¿Desea confirmar la operación?
              </p>
            ) : (
              <p style={{ fontSize: '14px', color: '#ff7c7c', marginBottom: '20px' }}>
                No hay filas válidas para importar en este archivo.
              </p>
            )}

            <div className="lineup-editor__actions">
              <button
                className="primary-action"
                type="button"
                onClick={handleImport}
                disabled={loading || report.persisted === 0}
              >
                {loading ? 'Importando...' : 'Confirmar Importación'}
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={handleCancel}
                disabled={loading}
              >
                Volver a editar
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
