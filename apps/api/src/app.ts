import Fastify, { type FastifyServerOptions } from 'fastify';
import { matches, urbaStandings } from './demo-data';

export function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get('/health', async () => ({
    service: 'ovalia-api',
    status: 'ready',
  }));

  app.get('/v1/matches', async (request) => {
    const query = request.query as { status?: string; competition?: string };
    const filtered = matches.filter((match) => {
      if (query.status && match.status !== query.status) return false;
      if (query.competition && match.competition !== query.competition) return false;
      return true;
    });
    return { generatedAt: new Date().toISOString(), matches: filtered };
  });

  app.get('/v1/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = matches.find((candidate) => candidate.id === id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });
    return { match };
  });

  app.get('/v1/competitions/:slug/standings', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    if (slug !== 'urba-top-14') return reply.code(404).send({ error: 'competition_not_found' });
    return { competition: 'URBA Top 14', season: 2026, rows: urbaStandings };
  });

  return app;
}
