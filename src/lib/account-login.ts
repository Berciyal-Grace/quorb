// Login de una cuenta adicional: no se abre el CLI hasta que la cuenta está
// persistida. Antes se abría igualmente aunque el guardado fallara, y el CLI
// buscaba una cuenta que el backend todavía no tenía.

export interface OpenAccountLoginDeps {
  /** Guarda los cambios pendientes; `true` solo si la config quedó persistida. */
  save: () => Promise<boolean>;
  /** Abre el login del CLI para la cuenta. */
  open: () => Promise<void>;
}

/**
 * Abre el login de la cuenta y confirma que se abrió. Si la cuenta no está
 * persistida, primero guarda: sin una confirmación explícita (`true`) no abre,
 * ni siquiera con una implementación antigua que resuelva `void`.
 */
export async function openAccountLogin(persisted: boolean, deps: OpenAccountLoginDeps): Promise<boolean> {
  if (!persisted) {
    const saved = await deps.save();
    if (saved !== true) return false;
  }
  await deps.open();
  return true;
}
