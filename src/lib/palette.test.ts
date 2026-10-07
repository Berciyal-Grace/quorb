import { describe, expect, it } from 'vitest';
import { derivePalette, normalizeHex, parseHex } from './palette';

describe('palette', () => {
  it('parses hex', () => {
    expect(parseHex('#ff0036')).toEqual([255, 0, 54]);
    expect(parseHex('0f0')).toEqual([0, 255, 0]);
    expect(parseHex('rojo')).toBeNull();
  });

  it('keeps the chosen color as the first ring', () => {
    expect(derivePalette('#ff0036')[0]).toBe('#ff0036');
    expect(derivePalette('#22c55e')[0]).toBe('#22c55e');
  });

  it('derives a near-white and a mid tint', () => {
    const [, light, mid] = derivePalette('#ff0036');
    expect(light).toBe('#ffebef');
    expect(mid).toBe('#ff859f');
  });

  it('lifts colors too dark to see on black', () => {
    const [c] = derivePalette('#000080');
    const [r, g, b] = parseHex(c)!;
    expect(Math.max(r, g, b)).toBeGreaterThan(200);
  });

  it('falls back to the default on invalid input', () => {
    expect(normalizeHex('nope')).toBe('#ff0036');
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
  });
});
