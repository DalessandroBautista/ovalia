import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import { articles } from '../schema.js';

export type ArticleStatus = 'draft' | 'review' | 'published' | 'archived';

export class ArticleTransitionError extends Error {
  constructor(from: ArticleStatus, to: ArticleStatus) {
    super(`invalid_article_transition:${from}->${to}`);
    this.name = 'ArticleTransitionError';
  }
}

export function countPendingDrafts(db: Database): Promise<number> {
  return db.$count(articles, inArray(articles.status, ['draft', 'review']));
}

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

export function findArticleById(db: Database, id: string) {
  return db.query.articles.findFirst({ where: eq(articles.id, id) });
}

export function listEditorialQueue(db: Database, limit = 100) {
  return db.query.articles.findMany({
    where: inArray(articles.status, ['draft', 'review']),
    orderBy: desc(articles.createdAt),
    limit,
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
    coverImageUrl?: string | null;
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
      coverImageUrl: input.coverImageUrl ?? null,
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

export async function transitionArticleStatus(db: Database, id: string, status: ArticleStatus) {
  const current = await findArticleById(db, id);
  if (!current) return null;
  const transitions: Record<ArticleStatus, ArticleStatus[]> = {
    draft: ['review'],
    review: ['draft', 'published'],
    published: ['archived'],
    archived: [],
  };
  if (!transitions[current.status].includes(status)) throw new ArticleTransitionError(current.status, status);
  const [row] = await db
    .update(articles)
    .set({ status, publishedAt: status === 'published' ? new Date() : null })
    .where(eq(articles.id, id))
    .returning();
  return row!;
}

export async function updateArticleContent(
  db: Database,
  id: string,
  input: { title: string; summary: string; body: string; coverImageUrl?: string | null },
) {
  const [row] = await db
    .update(articles)
    .set(input)
    .where(eq(articles.id, id))
    .returning();
  return row ?? null;
}
