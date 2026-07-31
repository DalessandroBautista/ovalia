import { describe, expect, it } from 'vitest';
import { parseLineupText } from './lineup-parser';

describe('parseLineupText', () => {
  it('devuelve entries vacías y sin warnings para texto vacío', () => {
    const result = parseLineupText('');
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('parsea una formación estándar de 15 titulares', () => {
    const text = [
      '1. Marcos Torrillas',
      '2. Juan Cruz Pérez',
      '3. Santiago Gómez',
      '4. Pedro Rodríguez',
      '5. Luis Fernández',
      '6. Martín López',
      '7. Diego Martínez',
      '8. Carlos González',
      '9. Andrés Ramírez',
      '10. Facundo Torres',
      '11. Nicolás Sánchez',
      '12. Alejandro Díaz',
      '13. Matías Ruiz',
      '14. Lucas Romero',
      '15. Pablo Castro',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(15);
    expect(result.warnings).toEqual([]);
    expect(result.entries[0]).toEqual({
      shirtNumber: 1,
      name: 'Marcos Torrillas',
      isCaptain: false,
      isStarter: true,
    });
    expect(result.entries[14]!.isStarter).toBe(true);
  });

  it('clasifica como suplentes los números 16 en adelante', () => {
    const text = [
      '15. Pablo Castro',
      '16. Roberto Méndez',
      '17. Javier Alonso',
      '23. Gustavo Pardo',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(4);
    expect(result.entries[0]!.isStarter).toBe(true);
    expect(result.entries[1]!.isStarter).toBe(false);
    expect(result.entries[1]!.shirtNumber).toBe(16);
    expect(result.entries[2]!.isStarter).toBe(false);
    expect(result.entries[3]!.shirtNumber).toBe(23);
    expect(result.entries[3]!.isStarter).toBe(false);
  });

  it('detecta la marca de capitán en variantes (c), (C), [c]', () => {
    const text = [
      '1. Marcos Torrillas (c)',
      '2. Juan Cruz Pérez (C)',
      '3. Santiago Gómez [c]',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries[0]!.isCaptain).toBe(true);
    expect(result.entries[0]!.name).toBe('Marcos Torrillas');
    expect(result.entries[1]!.isCaptain).toBe(true);
    expect(result.entries[1]!.name).toBe('Juan Cruz Pérez');
    expect(result.entries[2]!.isCaptain).toBe(true);
    expect(result.entries[2]!.name).toBe('Santiago Gómez');
  });

  it('acepta formato sin punto: "1 Nombre"', () => {
    const text = '10 Facundo Torres';
    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.shirtNumber).toBe(10);
    expect(result.entries[0]!.name).toBe('Facundo Torres');
  });

  it('ignora líneas en blanco intercaladas', () => {
    const text = [
      '1. Marcos Torrillas',
      '',
      '   ',
      '2. Juan Cruz Pérez',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it('reporta como warning las líneas sin número válido', () => {
    const text = [
      '1. Marcos Torrillas',
      'Director Técnico: Juan Pérez',
      '2. Juan Cruz Pérez',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Director Técnico');
  });

  it('reporta como warning los números duplicados y conserva el primero', () => {
    const text = [
      '1. Marcos Torrillas',
      '1. Otro Jugador',
      '2. Juan Cruz Pérez',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]!.name).toBe('Marcos Torrillas');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('duplicado');
  });

  it('maneja números de dos dígitos correctamente', () => {
    const text = '22. Roberto Méndez';
    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.shirtNumber).toBe(22);
  });

  it('rechaza números fuera de rango razonable (0 o >99)', () => {
    const text = [
      '0. Inválido',
      '1. Válido',
      '100. También inválido',
    ].join('\n');

    const result = parseLineupText(text);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.name).toBe('Válido');
    expect(result.warnings).toHaveLength(2);
  });

  it('recorta espacios del nombre', () => {
    const text = '10.   Facundo Torres   ';
    const result = parseLineupText(text);
    expect(result.entries[0]!.name).toBe('Facundo Torres');
  });
});
