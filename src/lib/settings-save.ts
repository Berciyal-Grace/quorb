import type { AppConfig } from './types';
import type { AutostartApplyOutcome } from './autostart-controller';

// Coordinador del guardado mixto de Ajustes. La config se persiste por la cola
// existente y el autostart se aplica contra el sistema operativo. Las dos partes
// se intentan siempre y se reportan por separado: no hay un «guardado atómico»
// falso que oculte que una mitad falló.

/** Mensaje legible de cualquier rechazo. */
function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  return String(e);
}

export interface MixedSaveInput {
  /** ¿Hay cambios manuales de config pendientes? */
  configDirty: boolean;
  /** Config a enviar (instantánea al pulsar Guardar). */
  configSnapshot: AppConfig;
  /** ¿El borrador de autostart difiere de la base confirmada? */
  autostartDirty: boolean;
  /** Valor de autostart deseado (instantánea al pulsar Guardar). */
  autostartDesired: boolean;
}

export interface MixedSaveDeps {
  /** Guarda por la cola existente (snapshot + reconcile en Ajustes). */
  saveConfig: (snapshot: AppConfig) => Promise<AppConfig>;
  /** Aplica y confirma el autostart; ver `AutostartApplyOutcome`. */
  applyAutostart: (desired: boolean) => Promise<AutostartApplyOutcome>;
}

export type MixedConfigPart = { status: 'saved'; saved: AppConfig } | { status: 'failed'; message: string } | { status: 'skipped' };
export type AutostartFailure = Extract<AutostartApplyOutcome, { ok: false }>;
export type MixedAutostartPart = { status: 'confirmed' } | { status: 'failed'; outcome: AutostartFailure } | { status: 'skipped' };

export interface MixedSaveResult {
  config: MixedConfigPart;
  autostart: MixedAutostartPart;
}

export async function runMixedSave(input: MixedSaveInput, deps: MixedSaveDeps): Promise<MixedSaveResult> {
  const configPart = async (): Promise<MixedConfigPart> => {
    if (!input.configDirty) return { status: 'skipped' };
    try {
      return { status: 'saved', saved: await deps.saveConfig(input.configSnapshot) };
    } catch (e) {
      return { status: 'failed', message: errorText(e) };
    }
  };

  const autostartPart = async (): Promise<MixedAutostartPart> => {
    if (!input.autostartDirty) return { status: 'skipped' };
    try {
      const outcome = await deps.applyAutostart(input.autostartDesired);
      return outcome.ok ? { status: 'confirmed' } : { status: 'failed', outcome };
    } catch (e) {
      return { status: 'failed', outcome: { ok: false, stage: 'apply', message: errorText(e) } };
    }
  };

  // Ambas partes se intentan aunque la otra falle: sus resultados son independientes.
  const [config, autostart] = await Promise.all([configPart(), autostartPart()]);
  return { config, autostart };
}

/**
 * Mensaje para el usuario a partir del resultado real de cada parte. Nunca
 * presenta una parte omitida como guardada y nunca da un éxito conjunto falso:
 * nombra exactamente lo que se confirmó y lo que falló, con su error.
 */
export function mixedSaveMessage(result: MixedSaveResult): string | null {
  const cfgError = result.config.status === 'failed' ? `Configuración no guardada: ${result.config.message}` : null;
  const osError = result.autostart.status === 'failed' ? `Inicio con Windows no guardado: ${result.autostart.outcome.message}` : null;
  const cfgSaved = result.config.status === 'saved';
  const osConfirmed = result.autostart.status === 'confirmed';

  if (cfgError && osError) return `${cfgError} · ${osError}`;
  if (cfgError) return osConfirmed ? `Inicio con Windows guardado · ${cfgError}` : cfgError;
  if (osError) return cfgSaved ? `Configuración guardada · ${osError}` : osError;
  if (cfgSaved || osConfirmed) return 'Guardado ✓';
  return null;
}
