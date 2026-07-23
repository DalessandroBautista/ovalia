import { describe, expect, it } from 'vitest';
import { generateMatchDraft } from './editorial-agent';

describe('editorial agent', () => {
  it('creates a reviewable draft and never publishes it', async () => {
    const client = {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            title: 'Los Pumas lo dieron vuelta en el cierre',
            summary: 'Argentina se impuso por tres puntos.',
            body: 'Una reacción en el segundo tiempo cambió el partido.',
            tags: ['Los Pumas', 'Rugby Championship']
          })
        })
      }
    };

    const draft = await generateMatchDraft(client, {
      competition: 'Rugby Championship',
      homeTeam: 'Argentina',
      awayTeam: 'Sudáfrica',
      homeScore: 24,
      awayScore: 21,
      events: []
    });

    expect(draft.status).toBe('review');
    expect(draft.aiGenerated).toBe(true);
    expect(draft.title).toContain('Los Pumas');
  });
});
