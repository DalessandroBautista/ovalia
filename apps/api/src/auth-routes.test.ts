import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getTestDatabase, isDatabaseAvailable, truncateAll } from '@ovalia/database/test-support';
import { buildApp } from './create-app';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('auth routes', () => {
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

  it('registra, inicia sesión, devuelve la identidad y revoca la sesión', async () => {
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);

    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'Persona@Example.Test', displayName: 'Persona', password: 'clave-segura' },
    });
    expect(registered.statusCode).toBe(201);
    expect(registered.json().user.email).toBe('persona@example.test');
    const cookie = registered.headers['set-cookie'];
    expect(cookie).toEqual(expect.stringContaining('ovalia_session='));

    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.displayName).toBe('Persona');

    const loggedOut = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } });
    expect(loggedOut.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } })).statusCode).toBe(401);
  });

  it('rechaza credenciales inválidas y evita duplicados de email', async () => {
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);

    const first = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'same@example.test', displayName: 'Uno', password: 'clave-segura' },
    });
    expect(first.statusCode).toBe(201);
    expect((await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'SAME@example.test', displayName: 'Dos', password: 'clave-segura' },
    })).statusCode).toBe(409);
    expect((await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'same@example.test', password: 'incorrecta' },
    })).statusCode).toBe(401);
  });

  it('emite tokens de verificación y permite restablecer la contraseña', async () => {
    const messages: Array<{ kind: string; token: string }> = [];
    const app = buildApp({ logger: false }, {
      db: handle.db,
      sendAuthEmail: async (message) => { messages.push({ kind: message.kind, token: message.token }); },
    });
    apps.push(app);
    expect((await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'reset@example.test', displayName: 'Reset', password: 'clave-segura' },
    })).statusCode).toBe(201);

    expect((await app.inject({
      method: 'POST',
      url: '/auth/password-reset/request',
      payload: { email: 'reset@example.test' },
    })).statusCode).toBe(202);
    const reset = messages.find((message) => message.kind === 'password-reset');
    expect(reset?.token).toBeTruthy();
    expect((await app.inject({
      method: 'POST',
      url: '/auth/password-reset/confirm',
      payload: { token: reset!.token, password: 'nueva-clave-segura' },
    })).statusCode).toBe(204);
    expect((await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset@example.test', password: 'nueva-clave-segura' },
    })).statusCode).toBe(200);
  });

  it('rechaza mutaciones con un Origin externo para evitar CSRF', async () => {
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { origin: 'https://evil.example' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('csrf_origin_rejected');
  });
});
