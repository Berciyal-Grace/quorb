import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { checkForUpdate, installUpdate, UPDATE_EVENTS, type UpdateInfo, type UpdatePhase } from './updater';
import { createUpdaterController } from './updater-controller';

/** Controlador con las dependencias reales de Tauri; el hook y los tests comparten el mismo cableado. */
export function createUpdaterControllerWithDefaults() {
  return createUpdaterController({
    check: checkForUpdate,
    install: installUpdate,
    listen: (handler) => listen<UpdateInfo>(UPDATE_EVENTS.available, ({ payload }) => handler(payload)),
  });
}

/** Versión ofrecida (si la hay) a partir del estado, para pintarla en Ajustes. */
export function availableFromState(state: UpdatePhase): UpdateInfo | null {
  return state.phase === 'available' || state.phase === 'installing' ? state.info : null;
}

/**
 * Estado de actualización para Ajustes: comprueba al abrir (si las automáticas están
 * activas), escucha el aviso de la tira y expone «buscar ahora» e «instalar».
 * `start`/`stop` son simétricos, así que StrictMode no lo deja desactivado.
 */
export function useUpdater(auto: boolean) {
  const [controller] = useState(createUpdaterControllerWithDefaults);
  const [state, setState] = useState<UpdatePhase>(() => controller.getState());

  useEffect(() => {
    const off = controller.subscribe(setState);
    controller.start();
    if (auto) void controller.check(true);
    return () => {
      off();
      controller.stop();
    };
  }, [controller, auto]);

  const check = useCallback((silent = false) => controller.check(silent), [controller]);
  const install = useCallback(() => controller.install(), [controller]);

  return { state, available: availableFromState(state), check, install };
}
