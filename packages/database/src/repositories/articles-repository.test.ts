import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ArticleTransitionError, createDraft, transitionArticleStatus } from './articles-repository';
import { getTestDatabase, isDatabaseAvailable, truncateAll } from '../test-support';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('article workflow', () => {
  let handle: Awaited<ReturnType<typeof getTestDatabase>>;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('permite revisión y publicación, pero no salta la revisión', async () => {
    const draft = await createDraft(handle.db, {
      slug: 'nota-1',
      title: 'Una nota suficientemente larga',
      summary: 'Un resumen editorial verificable.',
      body: 'Un cuerpo editorial verificable y suficientemente largo.',
    });
    await expect(transitionArticleStatus(handle.db, draft.id, 'published')).rejects.toBeInstanceOf(ArticleTransitionError);
    const review = await transitionArticleStatus(handle.db, draft.id, 'review');
    expect(review?.status).toBe('review');
    const published = await transitionArticleStatus(handle.db, draft.id, 'published');
    expect(published?.status).toBe('published');
    expect(published?.publishedAt).toBeInstanceOf(Date);
  });

  it('conserva una imagen de portada opcional', async () => {
    const draft = await createDraft(handle.db, {
      slug: 'nota-con-imagen',
      title: 'Una nota con imagen de portada',
      summary: 'Un resumen editorial verificable.',
      body: 'Un cuerpo editorial verificable y suficientemente largo.',
      coverImageUrl: 'https://images.example/partido.webp',
    });

    expect(draft.coverImageUrl).toBe('https://images.example/partido.webp');
  });
});
