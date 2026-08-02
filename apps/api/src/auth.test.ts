import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('password authentication', () => {
  it('hashes passwords without making the original recoverable and verifies them', async () => {
    const hash = await hashPassword('una-clave-segura');

    expect(hash).not.toContain('una-clave-segura');
    expect(await verifyPassword('una-clave-segura', hash)).toBe(true);
    expect(await verifyPassword('otra-clave', hash)).toBe(false);
  });
});
