import { describe, expect, it, vi } from 'vitest';
import { openAccountLogin, type OpenAccountLoginDeps } from './account-login';

/** Login que se abre solo si la config quedó persistida (o ya lo estaba). */

describe('openAccountLogin', () => {
  it('no abre el login si el guardado requerido no confirma la config', async () => {
    const open = vi.fn(async () => {});
    const result = await openAccountLogin(false, { save: async () => false, open });
    expect(result).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('no abre si ya hay un guardado en curso que responde false', async () => {
    // Candado de `save()`: con un guardado en marcha responde `false` sin
    // confirmar la config. Aquí se arranca ya bloqueado para que la rama se
    // ejecute de verdad; el candado real de `savingRef` lo cubre el probe de
    // handlers del padre.
    let inFlight = true;
    const save = vi.fn(async () => {
      if (inFlight) return false;
      inFlight = false;
      return true;
    });
    const open = vi.fn(async () => {});
    expect(await openAccountLogin(false, { save, open })).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
    expect(inFlight).toBe(true); // el guardado sigue en curso: el candado no se ha tocado
    expect(open).not.toHaveBeenCalled();
  });

  it('no abre si el guardado resuelve sin confirmación explícita (undefined)', async () => {
    // Compatibilidad hacia atrás: una implementación antigua de `save` resolvía
    // `void`. Sin `true` no hay confirmación y el login debe bloquearse.
    const open = vi.fn(async () => {});
    const legacySave = (async () => {}) as unknown as OpenAccountLoginDeps['save'];
    expect(await openAccountLogin(false, { save: legacySave, open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it('espera al guardado diferido y solo entonces abre', async () => {
    let resolveSave!: (value: boolean) => void;
    const open = vi.fn(async () => {});
    const pending = openAccountLogin(false, {
      save: () => new Promise<boolean>((resolve) => (resolveSave = resolve)),
      open,
    });
    expect(open).not.toHaveBeenCalled();
    resolveSave(true);
    await expect(pending).resolves.toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('guarda primero y abre después, una sola vez', async () => {
    const order: string[] = [];
    const result = await openAccountLogin(false, {
      save: async () => {
        order.push('save');
        return true;
      },
      open: async () => {
        order.push('open');
      },
    });
    expect(result).toBe(true);
    expect(order).toEqual(['save', 'open']);
  });

  it('no guarda si la cuenta ya está persistida: abre directamente', async () => {
    const save = vi.fn(async () => true);
    const open = vi.fn(async () => {});
    expect(await openAccountLogin(true, { save, open })).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('propaga el error del guardado y no abre (lo captura el llamador)', async () => {
    const open = vi.fn(async () => {});
    await expect(
      openAccountLogin(false, {
        save: async () => {
          throw new Error('save boom');
        },
        open,
      }),
    ).rejects.toThrow('save boom');
    expect(open).not.toHaveBeenCalled();
  });

  it('propaga el error del login para el catch existente de `onError`', async () => {
    await expect(
      openAccountLogin(true, {
        save: async () => true,
        open: async () => {
          throw new Error('login boom');
        },
      }),
    ).rejects.toThrow('login boom');
  });
});
