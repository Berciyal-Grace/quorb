import { useCallback, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { checkForUpdate, installUpdate, updateErrorText, UPDATE_EVENTS, type UpdateInfo, type UpdatePhase } from './updater';

/**
 * Estado de actualización para Ajustes: comprueba al abrir (si las automáticas están activas),
 * escucha el aviso de la tira y expone «buscar ahora» e «instalar».
 */
export function useUpdater(auto: boolean) {
  const [state, setState] = useState<UpdatePhase>({ phase: 'idle' });

  const offer = useCallback((info: UpdateInfo) => {
    setState((s) => (s.phase === 'installing' ? s : { phase: 'available', info }));
  }, []);

  /** `silent`: sin «buscando…» ni errores a la vista (comprobación en segundo plano). */
  const check = useCallback(
    async (silent = false) => {
      if (!silent) setState({ phase: 'checking' });
      try {
        const info = await checkForUpdate();
        if (info) offer(info);
        else if (!silent) setState({ phase: 'none', checkedAt: Date.now() });
      } catch (e) {
        if (!silent) setState({ phase: 'error', message: updateErrorText(e) });
      }
    },
    [offer],
  );

  const install = useCallback(async () => {
    if (state.phase !== 'available') return;
    const info = state.info;
    setState({ phase: 'installing', info, progress: null });
    try {
      await installUpdate((progress) => setState({ phase: 'installing', info, progress }));
    } catch (e) {
      setState({ phase: 'error', message: updateErrorText(e) });
    }
  }, [state]);

  useEffect(() => {
    if (auto) check(true);
  }, [auto, check]);

  useEffect(() => {
    const off = listen<UpdateInfo>(UPDATE_EVENTS.available, ({ payload }) => offer(payload));
    return () => {
      off.then((f) => f());
    };
  }, [offer]);

  const available = state.phase === 'available' || state.phase === 'installing' ? state.info : null;
  return { state, available, check, install };
}
