'use client';

import { useEffect, useState } from 'react';

import { fetchArticles } from '../../lib/api/client';
import type { ApiArticleSummary } from '../../lib/api/types';
import { PortalHeader } from '../portal/portal-pages';

type Status = 'loading' | 'ready' | 'error';

export function NewsPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [articles, setArticles] = useState<ApiArticleSummary[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchArticles({ signal: controller.signal })
      .then((res) => {
        setArticles(res.articles);
        setStatus('ready');
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('error');
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="portal-shell">
      <PortalHeader />
      <main className="portal-main">
        <p className="eyebrow">EDITORIAL</p>
        <h1>Historias de rugby</h1>
        <p className="portal-intro">Noticias, análisis y protagonistas de cada rincón de la cancha.</p>
        {status === 'loading' ? <p className="portal-live-status">Cargando notas…</p> : null}
        {status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar las noticias.</p> : null}
        {status === 'ready' && articles.length === 0 ? (
          <p className="portal-live-status">Todavía no hay notas publicadas. Estamos preparando las primeras historias.</p>
        ) : null}
        <div className="article-grid">
          {articles.map((article) => (
            <article key={article.slug}>
              {article.coverImageUrl ? <img className="article-grid__cover" src={article.coverImageUrl} alt="" /> : null}
              <h2>{article.title}</h2>
              <p>{article.summary}</p>
              <a href={`/noticias/${article.slug}`}>Leer nota →</a>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
