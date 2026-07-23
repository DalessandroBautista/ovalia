import { z } from 'zod';

const generatedArticleSchema = z.object({
  title: z.string().min(8),
  summary: z.string().min(12),
  body: z.string().min(20),
  tags: z.array(z.string()).max(8)
});

export interface MatchEditorialInput {
  competition: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  events: Array<{ minute?: number; type: string; playerName?: string }>;
}

interface ResponsesClient {
  responses: {
    create(input: unknown): Promise<{ output_text: string }>;
  };
}

export async function generateMatchDraft(client: ResponsesClient, match: MatchEditorialInput) {
  const response = await client.responses.create({
    model: 'gpt-5-mini',
    instructions:
      'Sos un periodista especializado en rugby. Redactá sólo con los datos provistos, sin inventar jugadores, citas ni incidencias. Usá español rioplatense sobrio.',
    input: `Creá una nota post partido a partir de estos datos verificados: ${JSON.stringify(match)}`,
    text: {
      format: {
        type: 'json_schema',
        name: 'match_article_draft',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'body', 'tags'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            body: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  });

  const article = generatedArticleSchema.parse(JSON.parse(response.output_text));
  return { ...article, status: 'review' as const, aiGenerated: true as const, sourceData: match };
}
