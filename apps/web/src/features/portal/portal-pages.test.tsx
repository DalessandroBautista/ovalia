import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchesPage, PredictionPage, TournamentsPage } from './portal-pages';

describe('public portal pages', () => {
  it('renders the match center', () => {
    const html = renderToStaticMarkup(createElement(MatchesPage));
    expect(html).toContain('Centro de partidos');
    expect(html).toContain('Volver al inicio');
  });

  it('renders the complete tournament catalog', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('URBA Top 14');
    expect(html).toContain('Torneo del Interior');
    expect(html).toContain('Six Nations');
  });

  it('renders the prediction experience', () => {
    expect(renderToStaticMarkup(createElement(PredictionPage))).toContain('Prode Ovalia');
  });
});
