import { describe, expect, it, vi } from 'vitest';

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock, emit: vi.fn() }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));

import { UPDATE_EVENTS, type UpdateInfo } from './updater';
import { availableFromState, createUpdaterControllerWithDefaults } from './useUpdater';

const info = (version = '0.2.0'): UpdateInfo => ({ version, notes: null, date: null });

describe('useUpdater wiring', () => {
  it('subscribes to the stable availability channel', async () => {
    listenMock.mockResolvedValue(() => {});
    const controller = createUpdaterControllerWithDefaults();
    controller.start();
    expect(listenMock).toHaveBeenCalledWith(UPDATE_EVENTS.available, expect.any(Function));
    controller.stop();
  });

  it('turns a strip event into available state without a manual check', async () => {
    let handler: ((event: { payload: unknown }) => void) | null = null;
    listenMock.mockImplementation((_event: string, cb: (event: { payload: unknown }) => void) => {
      handler = cb;
      return Promise.resolve(() => {});
    });
    const controller = createUpdaterControllerWithDefaults();
    controller.start();
    handler!({ payload: { version: '0.3.0', notes: 'notas', date: '2025-01-01' } });
    expect(controller.getState()).toEqual({ phase: 'available', info: { version: '0.3.0', notes: 'notas', date: '2025-01-01' } });
    controller.stop();
  });

  it('ignores a malformed strip event payload', async () => {
    let handler: ((event: { payload: unknown }) => void) | null = null;
    listenMock.mockImplementation((_event: string, cb: (event: { payload: unknown }) => void) => {
      handler = cb;
      return Promise.resolve(() => {});
    });
    const controller = createUpdaterControllerWithDefaults();
    controller.start();
    handler!({ payload: { nope: true } });
    expect(controller.getState()).toEqual({ phase: 'idle' });
    controller.stop();
  });

  it('derives the offered version from available and installing states', () => {
    expect(availableFromState({ phase: 'idle' })).toBeNull();
    expect(availableFromState({ phase: 'none', checkedAt: 1 })).toBeNull();
    expect(availableFromState({ phase: 'error', message: 'x' })).toBeNull();
    expect(availableFromState({ phase: 'available', info: info() })).toEqual(info());
    expect(availableFromState({ phase: 'installing', info: info(), progress: 10 })).toEqual(info());
  });
});
