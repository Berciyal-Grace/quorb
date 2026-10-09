import { describe, expect, it, vi } from 'vitest';
import { createAutostartController, type AutostartControllerDeps } from './autostart-controller';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function setup(overrides: Partial<AutostartControllerDeps> = {}) {
  const deps: AutostartControllerDeps = {
    read: vi.fn(async () => false),
    enable: vi.fn(async () => {}),
    disable: vi.fn(async () => {}),
    ...overrides,
  };
  return { controller: createAutostartController(deps), deps };
}

describe('autostart controller', () => {
  it('reads the real OS state when started', async () => {
    const { controller, deps } = setup({ read: vi.fn(async () => true) });
    controller.start();
    await flush();
    expect(deps.read).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toEqual({ confirmed: true, busy: false, error: null });
  });

  it('shows a visible error and recovers on retry without faking false', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('no access')).mockResolvedValueOnce(true);
    const { controller } = setup({ read });
    controller.start();
    await flush();
    expect(controller.getState()).toMatchObject({ confirmed: null, busy: false });
    expect(controller.getState().error).toMatch(/no access/);
    await controller.load();
    expect(controller.getState()).toEqual({ confirmed: true, busy: false, error: null });
  });

  it('keeps the OS basis unknown while a read fails', async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error('boom'));
    const { controller } = setup({ read });
    controller.start();
    await flush();
    expect(controller.getState().confirmed).toBeNull();
  });

  it('confirms the basis only after a matching read-back', async () => {
    const read = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { controller, deps } = setup({ read });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toEqual({ ok: true, confirmed: true, skipped: false });
    expect(deps.enable).toHaveBeenCalledTimes(1);
    expect(deps.disable).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({ confirmed: true, busy: false, error: null });
  });

  it('never calls the OS when the desired value is already confirmed', async () => {
    const { controller, deps } = setup({ read: vi.fn(async () => true) });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toEqual({ ok: true, confirmed: true, skipped: true });
    expect(deps.enable).not.toHaveBeenCalled();
    expect(deps.disable).not.toHaveBeenCalled();
  });

  it('turns the basis unknown when the read-back fails after applying', async () => {
    const read = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('readback down'));
    const { controller, deps } = setup({ read });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toMatchObject({ ok: false, stage: 'readback' });
    expect(deps.enable).toHaveBeenCalledTimes(1);
    expect(controller.getState()).toMatchObject({ confirmed: null, busy: false, error: 'readback down' });
  });

  it('reports a mismatch as a visible failure but keeps the real basis', async () => {
    const read = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    const { controller } = setup({ read });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toMatchObject({ ok: false, stage: 'mismatch' });
    expect(controller.getState()).toMatchObject({ confirmed: false, busy: false });
    expect(controller.getState().error).toMatch(/desactivado/);
  });

  it('keeps the previous basis and draft when applying fails', async () => {
    const { controller } = setup({
      read: vi.fn(async () => false),
      enable: vi.fn(async () => Promise.reject(new Error('denied'))),
    });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toMatchObject({ ok: false, stage: 'apply' });
    expect(controller.getState()).toMatchObject({ confirmed: false, busy: false, error: 'denied' });
  });

  it('refuses to apply while the basis is unknown', async () => {
    const { controller, deps } = setup({ read: vi.fn(async () => Promise.reject(new Error('nope'))) });
    controller.start();
    await flush();
    const outcome = await controller.apply(true);
    expect(outcome).toMatchObject({ ok: false, stage: 'unknown' });
    expect(deps.enable).not.toHaveBeenCalled();
  });

  it('guards against overlapping applies', async () => {
    const pending = deferred<void>();
    const read = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { controller, deps } = setup({ read, enable: vi.fn(() => pending.promise) });
    controller.start();
    await flush();
    const first = controller.apply(true);
    const second = await controller.apply(true);
    expect(second).toMatchObject({ ok: false, stage: 'busy' });
    expect(deps.enable).toHaveBeenCalledTimes(1);
    pending.resolve();
    await first;
  });

  it('guards against overlapping loads', async () => {
    const pending = deferred<boolean>();
    const read = vi.fn(() => pending.promise);
    const { controller } = setup({ read });
    controller.start();
    const first = controller.load();
    await controller.load();
    expect(read).toHaveBeenCalledTimes(1);
    pending.resolve(true);
    await first;
  });

  it('does not publish to listeners after stop', async () => {
    const pending = deferred<boolean>();
    const { controller } = setup({ read: vi.fn(() => pending.promise) });
    const states: unknown[] = [];
    controller.subscribe((state) => states.push(state));
    controller.start();
    controller.stop();
    const publishedBeforeStop = states.length;
    pending.resolve(true);
    await flush();
    // Ni el resultado de la lectura en vuelo ni su `busy` llegan tras `stop()`.
    expect(states.length).toBe(publishedBeforeStop);
    expect(controller.getState()).toMatchObject({ confirmed: null, busy: false });
  });

  it('does not read back or publish when stopped during enable', async () => {
    const pending = deferred<void>();
    const read = vi.fn(async () => false);
    const { controller } = setup({ read, enable: vi.fn(() => pending.promise) });
    controller.start();
    await flush();
    expect(read).toHaveBeenCalledTimes(1); // solo la lectura inicial
    const states: unknown[] = [];
    controller.subscribe((state) => states.push(state));
    const applying = controller.apply(true);
    controller.stop();
    const publishedBeforeStop = states.length;
    pending.resolve();
    await applying;
    // Tras parar no se lee de vuelta ni se publica nada nuevo.
    expect(read).toHaveBeenCalledTimes(1);
    expect(states.length).toBe(publishedBeforeStop);
    expect(controller.getState()).toMatchObject({ confirmed: false, busy: false });
  });

  it('can be restarted after a stop (React StrictMode setup/cleanup/setup)', async () => {
    const read = vi.fn(async () => true);
    const { controller } = setup({ read });
    controller.start();
    controller.stop();
    controller.start();
    await flush();
    expect(controller.getState()).toEqual({ confirmed: true, busy: false, error: null });
  });
});
