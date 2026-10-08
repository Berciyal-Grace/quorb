import { describe, expect, it, vi } from 'vitest';
import { cancellableDelay, retryWithBackoff } from './startup';

const noSleep = async () => {};

describe('cancellableDelay', () => {
  it('resolves after the wait and clears its timer on abort', async () => {
    vi.useFakeTimers();
    try {
      const pending = cancellableDelay(500);
      await vi.advanceTimersByTimeAsync(500);
      await expect(pending).resolves.toBeUndefined();
      const controller = new AbortController();
      const aborted = cancellableDelay(5000, controller.signal);
      const failure = expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
      controller.abort();
      await failure;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('retryWithBackoff', () => {
  it('returns the first successful result without sleeping', async () => {
    const fn = vi.fn(async () => 'ok');
    const sleep = vi.fn(noSleep);
    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a transient failure and then resolves', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('state no gestionado')).mockResolvedValue('ok');
    const sleep = vi.fn(noSleep);
    await expect(retryWithBackoff(fn, { attempts: 3, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('backs off exponentially and caps the wait at maxDelayMs', async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(retryWithBackoff(fn, { attempts: 6, baseDelayMs: 100, maxDelayMs: 400, sleep })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(6);
    expect(delays).toEqual([100, 200, 400, 400, 400]);
  });

  it('surfaces the last error after exhausting attempts instead of hiding it', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('primero')).mockRejectedValue(new Error('ultimo'));
    await expect(retryWithBackoff(fn, { attempts: 2, sleep: noSleep })).rejects.toThrow('ultimo');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops retrying when the signal aborts during the wait (cancellation-safe)', async () => {
    const controller = new AbortController();
    const fn = vi.fn(async () => {
      throw new Error('fallo');
    });
    const sleep = vi.fn(async () => {
      controller.abort();
      const err = new Error('cancelado');
      err.name = 'AbortError';
      throw err;
    });
    await expect(retryWithBackoff(fn, { attempts: 5, sleep, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not call the task at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn(async () => 'ok');
    await expect(retryWithBackoff(fn, { sleep: noSleep, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fn).not.toHaveBeenCalled();
  });
});
