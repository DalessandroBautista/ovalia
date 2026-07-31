import { describe, expect, it } from 'vitest';
import { normalizePlayerName } from './player-identity';

describe('normalizePlayerName', () => {
  it('ordena alfabéticamente los tokens de un nombre simple', () => {
    expect(normalizePlayerName('Juan Cruz Pérez')).toBe('cruz juan perez');
  });

  it('normaliza un nombre con apellido primero separado por coma', () => {
    expect(normalizePlayerName('Pérez, Juan Cruz')).toBe('cruz juan perez');
  });

  it('ignora mayúsculas y minúsculas', () => {
    expect(normalizePlayerName('juan cruz perez')).toBe('cruz juan perez');
    expect(normalizePlayerName('JUAN CRUZ PÉREZ')).toBe('cruz juan perez');
  });

  it('quita diacríticos (tildes, virgulillas, etc.)', () => {
    expect(normalizePlayerName('Nicolás García')).toBe('garcia nicolas');
    expect(normalizePlayerName('Ñoño López')).toBe('lopez nono');
  });

  it('colapsa espacios múltiples y recorta bordes', () => {
    expect(normalizePlayerName('  Pérez ,  Juan  Cruz  ')).toBe('cruz juan perez');
  });

  it('descarta caracteres no alfanuméricos', () => {
    expect(normalizePlayerName("María O'Connor")).toBe('maria oconnor');
    expect(normalizePlayerName('García (lesionado)')).toBe('garcia lesionado');
  });

  it('devuelve cadena vacía para entrada vacía o solo ruido', () => {
    expect(normalizePlayerName('')).toBe('');
    expect(normalizePlayerName('   ')).toBe('');
    expect(normalizePlayerName('---')).toBe('');
  });

  it('maneja un solo token correctamente', () => {
    expect(normalizePlayerName('Pelé')).toBe('pele');
  });

  it('maneja nombres compuestos con guión', () => {
    expect(normalizePlayerName('Jean-Pierre Dubois')).toBe('dubois jean pierre');
  });
});
