import { describe, expect, it, vi } from 'vitest';

const { emitMock } = vi.hoisted(() => ({ emitMock: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ emit: emitMock }));

import { emitUpdateAvailable, progressPct, shouldNotifyUpdate, updateErrorText, UPDATE_EVENTS } from './updater';

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

  it('exposes a stable channel for update availability', () => {
    expect(UPDATE_EVENTS.available).toBe('quorb://update-available');
  });

  it('never breaks polling when announcing an update fails', async () => {
    emitMock.mockRejectedValueOnce(new Error('no receiver window'));
    await expect(emitUpdateAvailable({ version: '0.2.0', notes: null, date: null })).resolves.toBeUndefined();
    expect(emitMock).toHaveBeenCalledWith(UPDATE_EVENTS.available, { version: '0.2.0', notes: null, date: null });
  });
});
