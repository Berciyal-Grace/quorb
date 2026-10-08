import type { AppConfig } from './types';

// Seguimiento de cambios sin guardar de Ajustes. `baseline` es la última config
// confirmada por el backend; `draft` es lo que ve el formulario. Los campos vivos
// (tamaño/color) se persisten partiendo de la base, no del borrador.

/** Igualdad estructural profunda para valores de config serializables a JSON. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, (b as unknown[])[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]));
}

/**
 * Campos que se aplican al momento con `liveSave` (tamaño y color). No cuentan
 * como cambios manuales sin guardar: el botón «Guardar cambios» solo refleja lo
 * que espera confirmación explícita.
 */
const LIVE_FIELDS = ['orbSize', 'accentColor'] as const;

/** Copia de la config sin los campos vivos, para comparar solo lo manual. */
function withoutLiveFields(cfg: AppConfig): Omit<AppConfig, (typeof LIVE_FIELDS)[number]> {
  const rest: Record<string, unknown> = { ...cfg };
  for (const key of LIVE_FIELDS) delete rest[key];
  return rest as Omit<AppConfig, (typeof LIVE_FIELDS)[number]>;
}

/**
 * ¿Hay cambios manuales sin guardar? Sin base (aún cargando) no se considera
 * sucio. Los campos vivos (`liveSave`) se ignoran porque se persisten solos:
 * no deben activar «Guardar cambios» ni siquiera mientras su autosave está en
 * vuelo y la base canónica todavía no los refleja.
 */
export function isDirty(baseline: AppConfig | null, draft: AppConfig | null): boolean {
  if (!baseline || !draft) return false;
  return !deepEqual(withoutLiveFields(baseline), withoutLiveFields(draft));
}

/**
 * Config a persistir en un guardado inmediato: base persistida + solo el campo
 * vivo. Así un cambio vivo no pisa escrituras previas ni ensucia otros campos.
 */
export function liveSaveConfig(baseline: AppConfig, patch: Partial<AppConfig>): AppConfig {
  return { ...baseline, ...patch };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reconcilia el guardado con ediciones hechas mientras estaba en vuelo:
 * `base` = lo enviado, `saved` = canónico del backend, `latest` = borrador actual.
 * Los campos no tocados adoptan lo canónico; los tocados conservan la edición,
 * evitando que `setCfg(saved)` descarte cambios posteriores al clic.
 */
export function reconcileSaved<T>(base: T, saved: T, latest: T): T {
  if (deepEqual(latest, base)) return saved;
  if (deepEqual(saved, base)) return latest;
  if (isRecord(base) && isRecord(saved) && isRecord(latest)) {
    const out: Record<string, unknown> = { ...saved };
    for (const key of Object.keys(latest)) {
      out[key] = reconcileSaved(base[key], saved[key], latest[key]);
    }
    return out as T;
  }
  return latest;
}
