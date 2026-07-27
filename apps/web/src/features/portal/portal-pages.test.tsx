import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MatchesPage, PredictionPage, TournamentsPage } from './portal-pages';

describe('public portal pages', () => {
  it('renders the match center', () => {
    const html = renderToStaticMarkup(createElement(MatchesPage));
    expect(html).toContain('Centro de partidos');
    expect(html).toContain('Volver al inicio');
    expect(html).toContain('Día anterior');
    expect(html).toContain('Día siguiente');
    expect(html).toContain('Cargando la agenda');
  });

  it('renders the tournament catalog shell and loads from the API', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('Todos los torneos');
    // Sin datos precargados en SSR, muestra el estado de carga real (no un array hardcodeado).
    expect(html).toContain('Cargando torneos');
    expect(html).not.toContain('Six Nations');
  });

  it('renders the prediction experience', () => {
    expect(renderToStaticMarkup(createElement(PredictionPage))).toContain('Prode Ovalia');
  });
});
