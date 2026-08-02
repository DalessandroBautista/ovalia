import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDraft, createSession, listAudit } from '@ovalia/database';
import { getTestDatabase, isDatabaseAvailable, makeUser, truncateAll } from '@ovalia/database/test-support';
import { hashSessionToken } from './auth';
import { buildApp } from './create-app';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('editorial routes', () => {
  let handle: Awaited<ReturnType<typeof getTestDatabase>>;
  const apps: Array<ReturnType<typeof buildApp>> = [];

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
    delete process.env.ADMIN_TOKEN;
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('protege la cola por rol y audita la publicación', async () => {
    const editor = await makeUser(handle.db, { role: 'editor' });
    const sessionToken = 'editor-session-token';
    await createSession(handle.db, {
      userId: editor.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const draft = await createDraft(handle.db, {
      slug: 'cronica-final',
      title: 'Crónica del partido final',
      summary: 'Resumen editorial para revisión.',
      body: 'Contenido editorial verificable para la nota.',
    });
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    const headers = { cookie: `ovalia_session=${sessionToken}` };

    const queue = await app.inject({ method: 'GET', url: '/admin/articles', headers });
    expect(queue.statusCode).toBe(200);
    expect(queue.json().articles[0].id).toBe(draft.id);

    const review = await app.inject({
      method: 'POST',
      url: `/admin/articles/${draft.id}/status`,
      headers,
      payload: { status: 'review' },
    });
    expect(review.statusCode).toBe(200);

    const published = await app.inject({
      method: 'POST',
      url: `/admin/articles/${draft.id}/status`,
      headers,
      payload: { status: 'published' },
    });
    expect(published.statusCode).toBe(200);
    expect(published.json().article.status).toBe('published');
    expect((await listAudit(handle.db, 10)).some((entry) => entry.action === 'admin.article.status')).toBe(true);
  });

  it('permite editar el contenido antes de enviarlo a revisión', async () => {
    const editor = await makeUser(handle.db, { role: 'editor' });
    const sessionToken = 'editor-edit-session-token';
    await createSession(handle.db, {
      userId: editor.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(Date.now() + 60_000),
    });
    const draft = await createDraft(handle.db, {
      slug: 'borrador-editable',
      title: 'Título original',
      summary: 'Resumen original suficientemente largo.',
      body: 'Cuerpo original suficientemente largo para el artículo.',
    });
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    const headers = { cookie: `ovalia_session=${sessionToken}` };

    const detail = await app.inject({ method: 'GET', url: `/admin/articles/${draft.id}`, headers });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().article.body).toContain('Cuerpo original');
    const updated = await app.inject({
      method: 'PATCH',
      url: `/admin/articles/${draft.id}`,
      headers,
      payload: { title: 'Título corregido', summary: 'Resumen corregido suficientemente largo.', body: 'Cuerpo corregido y revisado para publicar.' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().article.title).toBe('Título corregido');
  });
});
