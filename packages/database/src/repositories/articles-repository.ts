import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client';
import { articles } from '../schema';

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export function listPublishedArticles(db: Database, opts: { locale?: string; limit?: number } = {}) {
  const locale = opts.locale ?? 'es';
  return db.query.articles.findMany({
    where: and(eq(articles.status, 'published'), eq(articles.locale, locale)),
    orderBy: desc(articles.publishedAt),
    limit: opts.limit ?? 20,
  });
}

export function findPublishedArticleBySlug(db: Database, slug: string, locale = 'es') {
  return db.query.articles.findFirst({
    where: and(
      eq(articles.slug, slug),
      eq(articles.locale, locale),
      eq(articles.status, 'published'),
    ),
  });
}

export async function featuredPublishedArticle(db: Database, locale = 'es') {
  const [row] = await db.query.articles.findMany({
    where: and(eq(articles.status, 'published'), eq(articles.locale, locale)),
    orderBy: desc(articles.publishedAt),
    limit: 1,
  });
  return row ?? null;
}

export async function createDraft(
  db: Database,
  input: {
    slug: string;
    title: string;
    summary: string;
    body: string;
    locale?: string;
    authorId?: string | null;
    aiGenerated?: boolean;
    sourceData?: Record<string, unknown>;
    status?: ArticleStatus;
  },
) {
  const [row] = await db
    .insert(articles)
    .values({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      locale: input.locale ?? 'es',
      status: input.status ?? 'draft',
      authorId: input.authorId ?? null,
      aiGenerated: input.aiGenerated ?? false,
      sourceData: input.sourceData ?? {},
    })
    .returning();
  return row!;
}

export async function setArticleStatus(
  db: Database,
  id: string,
  status: ArticleStatus,
) {
  const [row] = await db
    .update(articles)
    .set({ status, publishedAt: status === 'published' ? new Date() : null })
    .where(eq(articles.id, id))
    .returning();
  return row!;
}
