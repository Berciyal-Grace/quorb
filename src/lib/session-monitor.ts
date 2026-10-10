/**
 * Vigila el sello de sesión de los CLIs y refresca cuando cambia.
 *
 * Un refresco puede llegar mientras ya hay otro en curso (`inFlight` en el
 * widget): en ese caso `refresh()` resuelve `false` (ocupado) y el sello NO se
 * consume, de modo que la siguiente comprobación lo reintenta. Si el refresco
 * falla o el sello no se puede leer, tampoco se consume.
 */

export interface SessionMonitorDeps {
  /** Lee la huella actual de los ficheros de sesión. */
  stamp: () => Promise<number>;
  /**
   * Lanza un refresco. Resuelve `true` solo si el refresco se completó; `false`
   * si se omitió (por ejemplo, ya había uno en curso) o falló.
   */
  refresh: () => Promise<boolean>;
}

export interface SessionMonitor {
  /** Una vuelta del sondeo: lee el sello y refresca si cambió. */
  check(): Promise<void>;
  /** Deja de refrescar: descarta lecturas pendientes. */
  dispose(): void;
}

export function createSessionMonitor({ stamp, refresh }: SessionMonitorDeps): SessionMonitor {
  let last: number | null = null;
  let pending: number | null = null;
  let checking = false;
  let disposed = false;

  const check = async (): Promise<void> => {
    if (disposed || checking) return;
    checking = true;
    try {
      let s: number;
      try {
        s = await stamp();
      } catch {
        return; // el sondeo se reintenta en la siguiente vuelta
      }
      if (disposed) return;
      if (last != null && s !== last) pending = s;
      if (pending == null) {
        last = s;
        return;
      }
      let ok = false;
      try {
        ok = await refresh();
      } catch {
        ok = false;
      }
      if (disposed) return;
      if (ok) {
        last = pending;
        pending = null;
      }
    } finally {
      checking = false;
    }
  };

  return {
    check,
    dispose() {
      disposed = true;
    },
  };
}
