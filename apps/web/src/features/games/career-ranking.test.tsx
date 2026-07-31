import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CareerRanking } from './career-ranking';

vi.mock('./use-career-ranking', () => ({
  useCareerRanking: () => ({
    top: [{ id: '1', score: 900, displayName: 'Duro', summary: { tier: 't', verdict: 'v', score: 900, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [], createdAt: '' }],
    publish: vi.fn(),
    myEntry: null,
    error: null,
  }),
}));

describe('CareerRanking', () => {
  it('muestra el top del ranking', () => {
    render(<CareerRanking />);
    expect(screen.getByText('Duro')).toBeTruthy();
  });

  it('pide apodo para publicar y valida el campo', async () => {
    render(<CareerRanking />);
    await userEvent.click(screen.getByRole('button', { name: /Publicar en el ranking/i }));
    expect(screen.getByLabelText(/Apodo/i)).toBeTruthy();
  });
});
