// Contrato de la instalación asistida de Codex CLI (frontend).
// Los tipos espejo del backend viven aquí; `api.ts` solo los importa como tipos
// para no crear un ciclo de ejecución.
//
// El controlador es puro (sin React ni DOM) y con dependencias inyectadas: la UI
// solo pinta su estado y las pruebas lo ejercen con relojes y backends falsos.

export type CodexSetupOutcome = 'installed' | 'cancelled' | 'failed' | null;

/** Respuesta pasiva de `codex_setup_status` (camelCase, espejo del backend). */
export interface CodexSetupStatus {
  /** La instalación asistida solo existe en Windows. */
  supported: boolean;
  /** El backend tiene una instalación en curso (en esta o en otra ventana). */
  busy: boolean;
  /** Existe el par Node/npm; no valida la versión. */
  nodeAvailable: boolean;
  /** Hay un Codex CLI ya detectado (cualquier fuente conocida). */
  installed: boolean;
  /** Paquete fijo que instala el backend. */
  package: string;
  /** Mensaje acotado del backend; `null` si no hay. */
  message: string | null;
  /** Resultado de la última instalación recordado por el backend. */
  outcome: CodexSetupOutcome;
}

/** Respuesta de `install_codex` (camelCase, espejo del backend). */
export interface CodexInstallResult {
  outcome: 'installed' | 'cancelled';
  message: string;
}

/** Paquete oficial fijado; el backend instala exactamente esta versión, no «latest». */
export const CODEX_PACKAGE = '@openai/codex@0.162.1';

export interface CodexInstallState {
  /** Último estado pasivo leído del backend; `null` si aún no hay lectura. */
  status: CodexSetupStatus | null;
  /** Hay una lectura pasiva en curso. */
  reading: boolean;
  /** Hay una instalación en curso (la pidió esta ventana). */
  installing: boolean;
  /** Resultado de la última instalación terminada en esta sesión. */
  outcome: 'installed' | 'cancelled' | null;
  /** Mensaje informativo de la última instalación. */
  message: string | null;
  /** Error acotado que la UI puede mostrar; `null` si no hay. */
  error: string | null;
  /** Origen del error visible: una lectura pasiva o la propia instalación. */
  errorFrom: 'read' | 'install' | null;
}

export type CodexInstallRefusal = 'inactive' | 'in-flight' | 'busy' | 'unsupported' | 'no-node' | 'installed';

export type CodexInstallRequestOutcome =
  | { ok: true; outcome: 'installed' | 'cancelled' }
  | { ok: false; reason: CodexInstallRefusal | 'error'; message: string };

export interface CodexInstallDeps {
  /** Lectura pasiva del estado; nunca instala. */
  getStatus: () => Promise<CodexSetupStatus>;
  /** Pide al backend el diálogo nativo de confirmación y la instalación. */
  install: () => Promise<CodexInstallResult>;
  /** Aviso tras una instalación real: refresca la presencia del CLI fuera del componente. */
  onInstalled?: () => void;
  /** Intervalo del sondeo pasivo mientras el backend está ocupado. */
  intervalMs?: number;
  /** Temporizador inyectable para las pruebas (por defecto `setInterval`). */
  setInterval?: (fn: () => void, ms: number) => number;
  /** Cancelador inyectable para las pruebas (por defecto `clearInterval`). */
  clearInterval?: (handle: number) => void;
}

export interface CodexInstallController {
  getState(): CodexInstallState;
  subscribe(listener: (state: CodexInstallState) => void): () => void;
  /** El componente visible activa la lectura pasiva; al ocultarse se descarta lo en vuelo. */
  setVisible(visible: boolean): void;
  /** Arranque del ciclo de vida (raíz de Ajustes); idempotente. */
  start(): void;
  /** Parada del ciclo de vida: descarta resultados en vuelo y cancela el sondeo. */
  stop(): void;
  /** Relectura pasiva puntual (botón «Volver a comprobar»). */
  refresh(): Promise<CodexInstallState>;
  /** Pide instalar; solo instala con confirmación del diálogo nativo del backend. */
  requestInstall(): Promise<CodexInstallRequestOutcome>;
}

/**
 * Lo que la UI debe pintar. Se calcula aparte del controlador para poder probar
 * cada estado sin montar React.
 */
export type CodexInstallView =
  | { kind: 'loading' }
  | { kind: 'unsupported'; package: string }
  | { kind: 'no-node'; package: string }
  | { kind: 'installed'; justInstalled: boolean }
  | { kind: 'cancelled'; justCancelled: boolean }
  | { kind: 'busy' }
  | { kind: 'installing' }
  | { kind: 'error'; message: string; origin: 'read' | 'install' | 'backend' }
  | { kind: 'ready' };

export function codexInstallView(state: CodexInstallState): CodexInstallView {
  if (state.installing) return { kind: 'installing' };
  if (state.error) return { kind: 'error', message: state.error, origin: state.errorFrom === 'read' ? 'read' : 'install' };
  if (state.outcome === 'installed') return { kind: 'installed', justInstalled: true };
  if (state.outcome === 'cancelled') return { kind: 'cancelled', justCancelled: true };
  const s = state.status;
  if (!s) return { kind: 'loading' };
  // Ya hay un Codex CLI (aunque el comando de login guardado sea incorrecto):
  // no se ofrece un instalador duplicado.
  if (s.installed) return { kind: 'installed', justInstalled: false };
  if (!s.supported) return { kind: 'unsupported', package: s.package || CODEX_PACKAGE };
  if (!s.nodeAvailable) return { kind: 'no-node', package: s.package || CODEX_PACKAGE };
  if (s.busy) return { kind: 'busy' };
  if (s.outcome === 'installed') return { kind: 'installed', justInstalled: false };
  if (s.outcome === 'cancelled') return { kind: 'cancelled', justCancelled: false };
  if (s.outcome === 'failed') return { kind: 'error', message: s.message ?? 'La instalación falló.', origin: 'backend' };
  return { kind: 'ready' };
}

/** Acciones que la vista permite; el componente las usa para decidir sus botones. */
export type CodexInstallAction = 'install' | 'retry' | 'recheck' | 'copy';

/**
 * Acciones explícitas por estado. Es la única fuente de verdad de qué botones se
 * pueden pulsar: en particular, un fallo de lectura solo permite reintentar la
 * lectura (`recheck`) y nunca dispara una instalación.
 */
export function codexInstallActions(view: CodexInstallView): CodexInstallAction[] {
  switch (view.kind) {
    case 'ready':
      return ['install'];
    case 'busy':
    case 'installed':
      return view.kind === 'installed' && view.justInstalled ? [] : ['recheck'];
    case 'cancelled':
      return ['retry'];
    case 'error':
      return view.origin === 'read' ? ['recheck'] : ['retry', 'recheck'];
    case 'unsupported':
    case 'no-node':
      return ['recheck', 'copy'];
    default:
      return [];
  }
}

/** Tope del mensaje visible: el backend ya lo acota, pero nunca se pinta stderr crudo. */
const MAX_MESSAGE = 300;

function rawError(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return 'No se pudo completar la operación.';
}

/** Mensaje de una línea y acotado a `MAX_MESSAGE`; no redacta: el backend ya manda mensajes estáticos y saneados. */
function boundedCodexMessage(e: unknown): string {
  const text = rawError(e).replace(/\s+/g, ' ').trim();
  if (text.length <= MAX_MESSAGE) return text;
  return `${text.slice(0, MAX_MESSAGE - 1)}…`;
}

export function createCodexInstallController(deps: CodexInstallDeps): CodexInstallController {
  let state: CodexInstallState = { status: null, reading: false, installing: false, outcome: null, message: null, error: null, errorFrom: null };
  let running = false;
  let visible = false;
  // Cambia al parar: una instalación pendiente de un ciclo anterior no toca React.
  let lifeGen = 0;
  // Cambia al parar u ocultar: las lecturas que lleguen tarde no tocan el estado.
  let readGen = 0;
  let reading = false;
  // El backend sigue trabajando hasta que su promesa asienta: sobrevive a stop/start
  // para que no se pueda pedir una segunda instalación mientras la primera está viva.
  let pendingInstall = false;
  let handle: number | undefined;
  const timer = deps.setInterval ?? ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms));
  const clear = deps.clearInterval ?? ((h: number) => globalThis.clearInterval(h));
  const listeners = new Set<(state: CodexInstallState) => void>();

  const commit = (patch: Partial<CodexInstallState>) => {
    state = { ...state, ...patch };
  };
  // Tras parar la raíz no se notifica React ni se avisa al CLI.
  const emit = () => {
    if (!running) return;
    for (const listener of [...listeners]) listener(state);
  };
  const update = (patch: Partial<CodexInstallState>) => {
    commit(patch);
    emit();
  };

  // Solo se sondea (lectura pasiva) mientras la UI está visible y hay una
  // instalación en curso o el backend dice que otra ventana está trabajando.
  const shouldPoll = () => running && visible && (pendingInstall || state.status?.busy === true);

  const ensureTimer = () => {
    if (shouldPoll()) {
      if (handle === undefined) handle = timer(() => void refresh(), deps.intervalMs ?? 3000);
    } else if (handle !== undefined) {
      clear(handle);
      handle = undefined;
    }
  };

  const refresh = async (): Promise<CodexInstallState> => {
    if (!running || reading) return state;
    const gen = readGen;
    reading = true;
    update({ reading: true });
    try {
      const status = await deps.getStatus();
      if (!running || gen !== readGen) return state;
      const patch: Partial<CodexInstallState> = { status };
      // Un error solo de lectura se limpia al leer bien; uno de instalación se conserva.
      if (state.errorFrom === 'read') {
        patch.error = null;
        patch.errorFrom = null;
      }
      update(patch);
    } catch (e) {
      if (!running || gen !== readGen) return state;
      // Un fallo de lectura pasiva no pisa un resultado de instalación ya logrado
      // (ni una instalación en curso): evita el falso fallo tras instalar.
      if (state.outcome === null && !pendingInstall) {
        update({ error: boundedCodexMessage(e), errorFrom: 'read' });
      }
    } finally {
      reading = false;
      if (running && gen === readGen) update({ reading: false });
      ensureTimer();
    }
    return state;
  };

  const requestInstall = async (): Promise<CodexInstallRequestOutcome> => {
    // Un botón que llega tras parar la raíz no debe disparar procesos.
    if (!running) return { ok: false, reason: 'inactive', message: 'El instalador no está activo.' };
    if (pendingInstall) return { ok: false, reason: 'in-flight', message: 'Ya hay una instalación en curso.' };
    const status = state.status;
    if (status?.busy) return { ok: false, reason: 'busy', message: 'El instalador ya está trabajando. Espera a que termine.' };
    if (status?.installed) return { ok: false, reason: 'installed', message: 'Codex CLI ya está instalado. Revisa tu comando de login.' };
    if (status && !status.supported) return { ok: false, reason: 'unsupported', message: 'La instalación asistida solo está disponible en Windows.' };
    if (status && !status.nodeAvailable) return { ok: false, reason: 'no-node', message: 'No se detecta Node.js y npm en este equipo.' };

    const gen = lifeGen;
    pendingInstall = true;
    // El backend abre el diálogo nativo de confirmación; la UI solo espera.
    update({ installing: true, outcome: null, message: null, error: null, errorFrom: null });
    ensureTimer();
    try {
      const result = await deps.install();
      const stale = !running || gen !== lifeGen;
      commit({ installing: false });
      if (!stale) commit({ outcome: result.outcome, message: result.message, error: null, errorFrom: null });
      emit();
      if (!stale && result.outcome === 'installed') {
        // Refresca el CLI aunque el componente se haya desmontado: la raíz sigue viva.
        try {
          deps.onInstalled?.();
        } catch {
          /* el aviso es best-effort: no rompe el resultado */
        }
        void refresh();
      }
      return { ok: true, outcome: result.outcome };
    } catch (e) {
      const message = boundedCodexMessage(e);
      const stale = !running || gen !== lifeGen;
      commit({ installing: false });
      if (!stale) commit({ outcome: null, message: null, error: message, errorFrom: 'install' });
      emit();
      return { ok: false, reason: 'error', message };
    } finally {
      pendingInstall = false;
      ensureTimer();
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVisible(next) {
      if (visible === next) return;
      visible = next;
      if (next) {
        void refresh();
      } else {
        // Descarta lecturas en vuelo, pero deja terminar la instalación en curso.
        readGen += 1;
        reading = false;
      }
      ensureTimer();
    },
    start() {
      if (running) return;
      running = true;
      void refresh();
    },
    stop() {
      if (!running) return;
      running = false;
      visible = false;
      // El resultado de una instalación pendiente queda invalidado: no notifica
      // React ni avisa al CLI. El latch `pendingInstall` sigue vivo hasta asentar.
      lifeGen += 1;
      readGen += 1;
      reading = false;
      if (handle !== undefined) {
        clear(handle);
        handle = undefined;
      }
    },
    refresh,
    requestInstall,
  };
}
