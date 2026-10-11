import { useEffect, useSyncExternalStore } from 'react';
import { CODEX_PACKAGE, codexInstallActions, codexInstallView, type CodexInstallAction, type CodexInstallController } from '../lib/codex-install';

import { ownedHomeDir, useAppName } from '../lib/app-identity';

/**
 * Sustituye al aviso de copia solo para Codex: ofrece la instalación asistida
 * (con confirmación nativa del backend) y el rechequeo. Los demás proveedores
 * mantienen su flujo de copiar e instalar a mano.
 */
export function CodexInstall({ controller, onRecheck }: { controller: CodexInstallController; onRecheck: () => void }) {
  const appName = useAppName();
  const targetFolder = `%USERPROFILE%\\${ownedHomeDir(appName)}\\tools\\codex-0.162.1`;
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  // Visible mientras el componente está montado: al desmontarse se descarta la
  // lectura pasiva en vuelo, pero la instalación en curso sigue en el controlador
  // de la raíz y avisa al terminar.
  useEffect(() => {
    controller.setVisible(true);
    return () => controller.setVisible(false);
  }, [controller]);

  const view = codexInstallView(state);
  const actions = codexInstallActions(view);
  const can = (action: CodexInstallAction) => actions.includes(action);
  const copyCommand = () => {
    void navigator.clipboard?.writeText(`npm install -g ${CODEX_PACKAGE}`).catch(() => {});
  };
  // Relectura pasiva: nunca instala. Así, si Node aparece o el CLI se instala
  // fuera, el botón de instalar desaparece sin reinstalar nada.
  const recheck = () => {
    void controller.refresh();
    onRecheck();
  };

  return (
    <div className="eg-notice eg-notice--sm eg-notice--warning q-cli" role="status">
      <span className="eg-notice__text">
        {view.kind === 'loading' && (
          <>
            <b>Comprobando Codex CLI…</b> Quorb solo consulta el estado del equipo.
          </>
        )}
        {view.kind === 'ready' && (
          <>
            <b>Falta Codex CLI en este equipo.</b> Quorb puede instalarlo desde aquí: Windows pedirá confirmación antes de instalar nada.
          </>
        )}
        {view.kind === 'installing' && (
          <>
            <b>Instalando Codex CLI…</b> Confirma en la ventana de Windows si aparece. Puedes cancelar desde ahí.
          </>
        )}
        {view.kind === 'installed' && view.justInstalled && (
          <>
            <b>Codex CLI instalado.</b> La instalación no crea la sesión: usa «Iniciar sesión» cuando quieras.
          </>
        )}
        {view.kind === 'installed' && !view.justInstalled && (
          <>
            <b>Codex está instalado; revisa tu comando de login.</b> Quorb ya detecta el CLI en este equipo.
          </>
        )}
        {view.kind === 'cancelled' && (
          <>
            <b>Instalación cancelada.</b> No se cambió nada. Puedes intentarlo de nuevo.
          </>
        )}
        {view.kind === 'busy' && (
          <>
            <b>El instalador está trabajando en otra ventana.</b> Espera a que termine; Quorb lo detecta solo.
          </>
        )}
        {view.kind === 'unsupported' && (
          <>
            <b>Este sistema no permite la instalación asistida.</b> Está pensada para Windows; puedes instalarlo a mano y Quorb lo detectará.
          </>
        )}
        {view.kind === 'no-node' && (
          <>
            <b>No se detecta Node.js y npm.</b> Quorb solo comprueba que existan; la versión (Node.js 22 o superior) la valida el instalador al
            confirmar. Instálalos y vuelve a comprobar.
          </>
        )}
        {view.kind === 'error' && view.origin === 'read' && (
          <>
            <b>No se pudo consultar el instalador.</b> {view.message} Vuelve a comprobar el estado.
          </>
        )}
        {view.kind === 'error' && view.origin !== 'read' && (
          <>
            <b>No se pudo instalar Codex CLI.</b> {view.message} Puedes reintentarlo.
          </>
        )}
      </span>
      <span className="q-cli__cmd">
        {can('install') && (
          <button type="button" className="eg-btn eg-btn--primary eg-btn--sm" onClick={() => void controller.requestInstall()}>
            Instalar Codex
          </button>
        )}
        {view.kind === 'installing' && (
          <button type="button" className="eg-btn eg-btn--secondary eg-btn--sm" disabled>
            Instalando…
          </button>
        )}
        {can('retry') && (
          <button type="button" className="eg-btn eg-btn--secondary eg-btn--sm" onClick={() => void controller.requestInstall()}>
            Reintentar
          </button>
        )}
        {can('recheck') && (
          <button type="button" className="eg-btn eg-btn--secondary eg-btn--sm" onClick={recheck}>
            Volver a comprobar
          </button>
        )}
        {can('copy') && (
          <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={copyCommand}>
            Copiar orden
          </button>
        )}
      </span>
      <details className="q-details">
        <summary>Qué instala exactamente</summary>
        <ul className="q-note">
          <li>
            Paquete fijado: <code>{CODEX_PACKAGE}</code> desde el registro oficial de npm. No se instala «la última».
          </li>
          <li>
            Carpeta de destino: <code>{targetFolder}</code>, dentro de la carpeta de Quorb. No se toca el npm global ni las variables de entorno.
          </li>
          <li>Se ignoran los scripts de ciclo de vida del paquete y se valida la versión real antes de darlo por bueno.</li>
          <li>
            Antes de instalar, Quorb solo comprueba que Node.js y npm existan (sin ejecutarlos); la versión mínima se valida al confirmar la
            instalación. No se instala Node ni se piden permisos de administrador.
          </li>
        </ul>
      </details>
    </div>
  );
}
