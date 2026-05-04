import { describe, expect, it } from 'vitest';
import { getMapMarkerVariant } from './mapMarkerVariant';

describe('getMapMarkerVariant', () => {
  it('returns eco for standard activity labels', () => {
    expect(getMapMarkerVariant(['Сбор', 'Транспортирование'])).toBe('eco');
    expect(getMapMarkerVariant(['Утилизация', 'Обработка'])).toBe('eco');
    expect(getMapMarkerVariant(['Размещение'])).toBe('eco');
    expect(getMapMarkerVariant(undefined)).toBe('eco');
    expect(getMapMarkerVariant([])).toBe('eco');
  });

  it('returns tech for ГЭЭ / аренда технологий', () => {
    expect(getMapMarkerVariant(['Аренда и продажа технологий, прошедших ГЭЭ'])).toBe('tech');
    expect(getMapMarkerVariant(['Продажа технологий прошедшие ГЭЭ'])).toBe('tech');
    expect(getMapMarkerVariant(['ГЭЭ'])).toBe('tech');
  });

  it('returns storage for ГРОРРО / хранение и захоронение', () => {
    expect(getMapMarkerVariant(['Хранение и захоронение (объекты ГРОРРО)'])).toBe('storage');
    expect(getMapMarkerVariant(['Объекты ГРОРРО'])).toBe('storage');
    expect(getMapMarkerVariant(['Хранение', 'Захоронение'])).toBe('storage');
  });

  it('prefers tech when both special labels present', () => {
    expect(
      getMapMarkerVariant([
        'Хранение и захоронение (объекты ГРОРРО)',
        'Аренда технологий прошедшие ГЭЭ',
      ]),
    ).toBe('tech');
  });
});
