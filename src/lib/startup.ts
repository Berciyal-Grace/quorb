/**
 * Reintentos acotados y cancelables para el arranque.
 *
 * En Windows, la primera invocación tras instalar puede llegar antes de que el
 * backend haya registrado su estado; sin reintento el widget se queda sin config
 * (posición arbitraria) y sin datos hasta un refresco manual.
 */

/** Política del primer `getConfig` (la ventana puede montar antes que el estado Rust). */
export const STARTUP_RETRY = { attempts: 5, baseDelayMs: 400, maxDelayMs: 4000 };

/** Política de la primera carga de datos de uso: menos intentos para no alargar el spinner. */
export const USAGE_RETRY = { attempts: 3, baseDelayMs: 500, maxDelayMs: 2000 };

export interface RetryOptions {
  /** Intentos totales, incluido el primero (>= 1). */
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Se aborta sin más intentos ni actualizaciones tardías. */
  signal?: AbortSignal;
  /** Inyectable en tests para controlar las esperas. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function abortError(): Error {
  const err = new Error('cancelado');
  err.name = 'AbortError';
  return err;
}

/** Espera cancelable: al abortar, limpia el timer y rechaza con `AbortError`. */
export function cancellableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Ejecuta `fn` y reintenta con espera exponencial acotada. Tras agotar los
 * intentos propaga el último error (no oculta el fallo) y se detiene si el
 * `signal` se aborta.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? STARTUP_RETRY.attempts));
  const baseDelay = Math.max(0, options.baseDelayMs ?? STARTUP_RETRY.baseDelayMs);
  const maxDelay = Math.max(baseDelay, options.maxDelayMs ?? STARTUP_RETRY.maxDelayMs);
  const sleep = options.sleep ?? cancellableDelay;
  const { signal } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal?.aborted) throw abortError();
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || signal?.aborted) break;
      await sleep(Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)), signal);
    }
  }
  if (signal?.aborted) throw abortError();
  throw lastError;
}
