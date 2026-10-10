import { describe, expect, it, vi } from 'vitest';
import { createSessionMonitor } from './session-monitor';

/** Promesa controlable manualmente, sin depender de temporizadores reales. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('session-monitor', () => {
  it('does not refresh on the first observation', async () => {
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({ stamp: async () => 5, refresh });
    await m.check();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does nothing while the stamp is unchanged', async () => {
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({ stamp: async () => 5, refresh });
    await m.check();
    await m.check();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes on a changed stamp and consumes it on success', async () => {
    let stamp = 5;
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({ stamp: async () => stamp, refresh });
    await m.check();
    stamp = 6;
    await m.check();
    expect(refresh).toHaveBeenCalledTimes(1);
    // Ya consumido: el mismo sello no vuelve a refrescar.
    await m.check();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('retries on the next poll when the refresh was busy', async () => {
    let stamp = 5;
    const refresh = vi.fn();
    const m = createSessionMonitor({ stamp: async () => stamp, refresh });
    await m.check();
    stamp = 6;
    refresh.mockResolvedValueOnce(false); // ocupado: no completa el refresco
    await m.check();
    expect(refresh).toHaveBeenCalledTimes(1);
    refresh.mockResolvedValueOnce(true);
    await m.check(); // el sello sigue cambiado => reintenta
    expect(refresh).toHaveBeenCalledTimes(2);
    await m.check(); // éxito => consumido
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('retries on the next poll when the refresh fails', async () => {
    let stamp = 5;
    const refresh = vi.fn();
    const m = createSessionMonitor({ stamp: async () => stamp, refresh });
    await m.check();
    stamp = 6;
    refresh.mockRejectedValueOnce(new Error('fallo'));
    await m.check();
    expect(refresh).toHaveBeenCalledTimes(1);
    refresh.mockResolvedValueOnce(true);
    await m.check();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not start overlapping refreshes while one is pending', async () => {
    let calls = 0;
    const stampGate = deferred<number>();
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({
      stamp: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(5) : stampGate.promise;
      },
      refresh,
    });
    await m.check();
    const first = m.check();
    const second = m.check(); // se ignora: ya hay una comprobación en curso
    stampGate.resolve(6);
    await Promise.all([first, second]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh after dispose even if a pending read resolves', async () => {
    let calls = 0;
    const stampGate = deferred<number>();
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({
      stamp: () => {
        calls += 1;
        return calls === 1 ? Promise.resolve(5) : stampGate.promise;
      },
      refresh,
    });
    await m.check();
    const pending = m.check();
    m.dispose();
    stampGate.resolve(6);
    await pending;
    await m.check();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps polling after a stamp read error', async () => {
    let calls = 0;
    const refresh = vi.fn(async () => true);
    const m = createSessionMonitor({
      stamp: () => {
        calls += 1;
        if (calls === 1) return Promise.resolve(5);
        if (calls === 2) return Promise.reject(new Error('sin sello'));
        return Promise.resolve(6);
      },
      refresh,
    });
    await m.check();
    await m.check(); // error: no rompe el monitor
    await m.check(); // sello nuevo: refresca
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
