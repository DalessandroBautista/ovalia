import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createSession, deleteSessionByTokenHash, findSessionWithUserByTokenHash } from './sessions-repository';
import { getTestDatabase, isDatabaseAvailable, makeUser, truncateAll } from '../test-support';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('sessions repository', () => {
  let handle: Awaited<ReturnType<typeof getTestDatabase>>;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('crea una sesión, la recupera con el usuario y permite revocarla', async () => {
    const user = await makeUser(handle.db, { email: 'session@example.test' });
    const created = await createSession(handle.db, {
      userId: user.id,
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const found = await findSessionWithUserByTokenHash(handle.db, 'hash-1');
    expect(found?.session.id).toBe(created.id);
    expect(found?.user.email).toBe('session@example.test');

    await deleteSessionByTokenHash(handle.db, 'hash-1');
    expect(await findSessionWithUserByTokenHash(handle.db, 'hash-1')).toBeNull();
  });
});
