import { describe, expect, it } from 'vitest';
import { dueCapabilities, loadScheduleConfig } from './schedule';

const config = loadScheduleConfig();

describe('dueCapabilities', () => {
  const now = new Date('2026-08-01T12:00:00Z');

  it('marca vencidas las capacidades sin corrida previa', () => {
    expect(dueCapabilities(['fixtures', 'standings'], {}, config, now)).toEqual([
      'fixtures',
      'standings',
    ]);
  });

  it('no vence una capacidad ejecutada recientemente', () => {
    const recent = new Date(now.getTime() - 60 * 1000);
    expect(dueCapabilities(['fixtures'], { fixtures: recent }, config, now)).toEqual([]);
  });

  it('vence fixtures tras superar su intervalo', () => {
    const old = new Date(now.getTime() - 7 * 3600 * 1000);
    expect(dueCapabilities(['fixtures'], { fixtures: old }, config, now)).toEqual(['fixtures']);
  });

  it('nunca programa live por esta vía', () => {
    expect(dueCapabilities(['live'], {}, config, now)).toEqual([]);
  });
});
