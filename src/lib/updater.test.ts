import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

import { progressPct, shouldNotifyUpdate, updateErrorText } from './updater';

const memStore = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('updater', () => {
  it('computes progress', () => {
    expect(progressPct(50, 200)).toBe(25);
    expect(progressPct(300, 200)).toBe(100);
    expect(progressPct(10, 0)).toBe(0);
  });

  it('notifies once per version', () => {
    const s = memStore();
    expect(shouldNotifyUpdate('0.2.0', s)).toBe(true);
    expect(shouldNotifyUpdate('0.2.0', s)).toBe(false);
    expect(shouldNotifyUpdate('0.3.0', s)).toBe(true);
    expect(shouldNotifyUpdate('0.3.0', null)).toBe(false);
  });

  it('explains common errors', () => {
    expect(updateErrorText(new Error('signature verification failed'))).toMatch(/firma/);
    expect(updateErrorText('Could not fetch a valid release JSON from the remote')).toMatch(/release/);
    expect(updateErrorText(new Error('error sending request: dns error'))).toMatch(/conexión/);
    expect(updateErrorText('boom')).toBe('boom');
  });
});
