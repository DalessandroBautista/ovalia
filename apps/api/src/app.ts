import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { matches, urbaStandings } from './demo-data';
import { createConfiguredLiveProvider, createLiveFeedService, type LiveProvider } from './live/live-feed';

export function buildApp(options: FastifyServerOptions = {}, dependencies: { liveProvider?: LiveProvider } = {}) {
  const app = Fastify(options);
  const liveFeed = createLiveFeedService(dependencies.liveProvider ?? createConfiguredLiveProvider());

  void app.register(cors, {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.get('/health', async () => ({
    service: 'ovalia-api',
    status: 'ready',
  }));

  app.get('/v1/matches', async (request) => {
    const query = request.query as { status?: string; competition?: string };
    if (query.status === 'live') {
      const feed = await liveFeed.getLiveMatches();
      return { generatedAt: feed.generatedAt, matches: feed.matches };
    }
    const filtered = matches.filter((match) => {
      if (query.status && match.status !== query.status) return false;
      if (query.competition && match.competition !== query.competition) return false;
      return true;
    });
    return { generatedAt: new Date().toISOString(), matches: filtered };
  });

  app.get('/v1/live', async () => liveFeed.getLiveMatches());

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
