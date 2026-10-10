import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getVersion } from '@tauri-apps/api/app';
import { api } from './lib/api';
import { ORB_SIZE, type Account, type AccountProvider, type AlertMoment, type AppConfig, type Effect, type MediaSize, type ScopedSecretKey, type SecretKey, type SecretStatus } from './lib/types';
import { ACCOUNT_SECRETS, SESSION_DIR, accountReady, accountsOf, defaultSessionDir, newAccount, secretKey } from './lib/accounts';
import { ACCENT_PRESETS, DEFAULT_ACCENT, derivePalette, normalizeHex } from './lib/palette';
import { isDirty, isSettingsDirty, liveSaveConfig, reconcileSaved } from './lib/settings-dirty';
import { createAutostartController } from './lib/autostart-controller';
import { configPersistedAfterSave, runMixedSave, mixedSaveMessage, reloadSecretsAfterSave } from './lib/settings-save';
import { openAccountLogin } from './lib/account-login';
import { comboFromEvent, prettyCombo } from './lib/shortcuts';
import { ProviderLogo } from './components/ProviderLogo';
import quorbLogo from './assets/quorb-logo.png';
import { useUpdater } from './lib/useUpdater';

const LINKS = {
  anthropicAdmin: 'https://console.anthropic.com/settings/admin-keys',
  openaiAdmin: 'https://platform.openai.com/settings/organization/admin-keys',
  nanKeys: 'https://cloud.nan.builders/',
  nanDocs: 'https://nan.builders/docs',
  githubToken: 'https://github.com/settings/personal-access-tokens/new',
  openrouterKeys: 'https://openrouter.ai/settings/keys',
  geminiCli: 'https://github.com/google-gemini/gemini-cli',
  releases: 'https://github.com/egdev6/quorb/releases',
  repo: 'https://github.com/egdev6/quorb',
  issues: 'https://github.com/egdev6/quorb/issues/new?template=provider-request.md',
  web: 'https://egdev.es',
};

/** Dentro del panel lateral de un proveedor, las secciones no repiten su tarjeta: el título va en la cabecera del panel. */
const InDrawer = createContext(false);

function Section({ title, kicker, id, children }: { title: string; kicker?: string; id?: string; children: ReactNode }) {
  const inDrawer = useContext(InDrawer);
  if (inDrawer) {
    return (
      <div className="q-drawer__section" id={id}>
        {kicker && <p className="eg-eyebrow">{kicker}</p>}
        {children}
      </div>
    );
  }
  return (
    <section className="eg-module-card eg-module-card--banded q-section" id={id} aria-label={title}>
      <div className="eg-module-card__head">
        <div className="q-section__titles">
          {kicker && <p className="eg-eyebrow">{kicker}</p>}
          <h2>{title}</h2>
        </div>
      </div>
      <div className="eg-module-card__body">{children}</div>
    </section>
  );
}

function UpdatesSection({ auto, onAuto }: { auto: boolean; onAuto: (v: boolean) => void }) {
  const [version, setVersion] = useState<string>('');
  const { state, check, install } = useUpdater(auto);
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);

  return (
    <Section title="Versión instalada">
      {(state.phase === 'available' || state.phase === 'installing') && (
        <div className="eg-notice eg-notice--info" role="status">
          <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
          <span className="eg-notice__text">
            <b>Hay una versión nueva: {state.info.version}.</b> Se descarga, se comprueba la firma y Quorb se reinicia.
          </span>
          <span className="eg-notice__actions">
            <button type="button" className="eg-btn eg-btn--secondary eg-btn--sm" disabled={state.phase === 'installing'} onClick={install}>
              {state.phase === 'installing' ? `Instalando${state.progress != null ? ` · ${state.progress} %` : '…'}` : 'Instalar y reiniciar'}
            </button>
          </span>
        </div>
      )}
      {state.phase === 'installing' && (
        <div className="q-update-bar" aria-hidden="true">
          <span style={{ width: `${state.progress ?? 15}%` }} data-indeterminate={state.progress == null || undefined} />
        </div>
      )}
      {(state.phase === 'available' || state.phase === 'installing') && state.info.notes && <pre className="q-pre">{state.info.notes}</pre>}
      <div className="q-inline">
        <span className="q-note">
          Quorb <b>{version ? `v${version}` : ''}</b>
          {state.phase === 'none' && ' · estás en la última versión'}
        </span>
        <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" disabled={state.phase === 'checking' || state.phase === 'installing'} onClick={() => check()}>
          {state.phase === 'checking' ? 'Buscando…' : 'Buscar ahora'}
        </button>
      </div>
      {state.phase === 'error' && <div className="eg-notice eg-notice--warning eg-notice--sm"><span className="eg-notice__text">{state.message}</span></div>}
      <Rows>
        <Toggle label="Buscar actualizaciones solo" hint="Al arrancar y cada 6 h. Si hay una nueva, aparece un icono de descarga en la tira." checked={auto} onChange={onAuto} />
      </Rows>
      <small className="eg-field__hint">
        Llegan firmadas desde{' '}
        <button type="button" className="q-link" onClick={() => openUrl(LINKS.releases)}>
          GitHub Releases
        </button>
        ; si la firma no coincide, no se instalan.
      </small>
    </Section>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="q-row">
      <span className="q-row__text">
        <span className="q-row__label">{label}</span>
        {hint && <span className="q-row__hint">{hint}</span>}
      </span>
      <span className="eg-check eg-check--switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </span>
    </label>
  );
}

/** Varias filas con interruptor seguidas, separadas por una línea. */
function Rows({ children }: { children: ReactNode }) {
  return <div className="q-rows">{children}</div>;
}

function Field({ label, hint, value, children }: { label: string; hint?: ReactNode; value?: ReactNode; children: ReactNode }) {
  return (
    <label className={`eg-field${value != null ? ' eg-field--range' : ''}`}>
      <span className="eg-field__label">
        {label}
        {value != null && <output>{value}</output>}
      </span>
      {children}
      {hint && <small className="eg-field__hint">{hint}</small>}
    </label>
  );
}

/** Estilo de la pista de un range del DS (--v = parte rellena). */
const rangeFill = (v: number, min: number, max: number) => ({ '--v': `${((v - min) / (max - min)) * 100}%` }) as CSSProperties;

function Link({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        openUrl(href).catch(console.error);
      }}
    >
      {children}
    </a>
  );
}

function SecretInput({ id, label, configured, onSaved, hint }: { id: ScopedSecretKey; label: string; configured: boolean; onSaved: () => void; hint?: ReactNode }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async (v: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.setSecret(id, v);
      setValue('');
      setMsg(v ? 'Guardada en el Administrador de credenciales' : 'Eliminada');
      onSaved();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label={label} hint={msg ?? hint}>
      <div className="q-inline">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? '•••••••• (configurada)' : 'Pega aquí la key'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="eg-btn eg-btn--primary" disabled={busy || !value.trim()} onClick={() => save(value)}>
          Guardar
        </button>
        {configured && (
          <button className="eg-btn eg-btn--ghost" disabled={busy} onClick={() => save('')} title="Eliminar key">
            Quitar
          </button>
        )}
      </div>
    </Field>
  );
}

/** Conectar NaN Cloud como la CLI oficial: enlace de un solo uso enviado al correo. */
function NanConnect({ connected, onChange, account }: { connected: boolean; onChange: () => void; account?: string }) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [step, setStep] = useState<'email' | 'link'>('email');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (connected) {
    return (
      <div className="q-inline">
        <span className="eg-status eg-status--success">Cuenta de NaN Cloud conectada{msg ? ` · ${msg}` : ''}</span>
        <button
          className="eg-btn eg-btn--ghost eg-btn--sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.setSecret(account ? secretKey('nan_session', account) : 'nan_session', '');
              onChange();
            })
          }
        >
          Desconectar
        </button>
      </div>
    );
  }

  return (
    <div className="eg-field">
      <span className="eg-field__label">Conectar tu cuenta (recomendado)</span>
      {step === 'email' ? (
        <div className="q-inline">
          <input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="eg-btn eg-btn--primary"
            disabled={busy || !email.includes('@')}
            onClick={() =>
              run(async () => {
                await api.nanLoginRequest(email);
                setStep('link');
                setMsg('Te hemos enviado un enlace. Cópialo (sin abrirlo) y pégalo aquí.');
              })
            }
          >
            Enviar enlace
          </button>
        </div>
      ) : (
        <div className="q-inline">
          <input type="text" spellCheck={false} placeholder="https://…nan.builders/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button
            className="eg-btn eg-btn--primary"
            disabled={busy || !link.trim()}
            onClick={() =>
              run(async () => {
                const who = await api.nanLoginComplete(link, account);
                setMsg(`Conectado como ${who}`);
                setLink('');
                onChange();
              })
            }
          >
            Conectar
          </button>
          <button className="eg-btn eg-btn--ghost" disabled={busy} onClick={() => setStep('email')}>
            Volver
          </button>
        </div>
      )}
      <small className="eg-field__hint">
        {msg ??
          'Igual que «nan auth login --email»: NaN te manda un enlace de un solo uso. No lo abras en el navegador (se gastaría): cópialo y pégalo aquí. La sesión se guarda en el Administrador de credenciales de Windows y da los mismos datos que tu dashboard.'}
      </small>
    </div>
  );
}

/** Muestra las respuestas en crudo de la API de NaN con tu key (para depurar). */
function NanProbe() {
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <details className="q-details">
      <summary>Probar la API de NaN con la key</summary>
      <button
        className="eg-btn eg-btn--ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setOut(await api.nanProbe());
          } catch (e) {
            setOut(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Consultando…' : 'Ver respuestas de /v1/models y /v1/usage'}
      </button>
      {out && <pre className="q-pre">{out}</pre>}
    </details>
  );
}

const EFFECT_OPTIONS: { value: Effect; label: string }[] = [
  { value: 'confetti', label: 'Confeti' },
  { value: 'glow', label: 'Glow de peligro' },
  { value: 'custom', label: 'Efecto propio (vídeo o imagen animada)' },
  { value: 'none', label: 'Ninguno' },
];

async function testEffect(kind: Effect, moment: AlertMoment, alerts: AppConfig['alerts'], persist: (alerts: AppConfig['alerts']) => Promise<void>) {
  if (kind === 'none') return;
  // El archivo del efecto propio se lee de la config guardada: guardamos antes lo que haya en el formulario.
  await persist(alerts);
  const m = await currentMonitor();
  if (!m) return;
  await api.playEffect(kind, moment, { x: m.position.x, y: m.position.y, width: m.size.width, height: m.size.height });
}

const MEDIA_FILTERS = [{ name: 'Vídeo o imagen animada', extensions: ['webm', 'mp4', 'gif', 'webp', 'png', 'apng'] }];

const fileName = (p: string | null) => (p ? p.split(/[\\/]/).pop() : null);

/** Un momento de aviso: efecto + archivo propio + botón de prueba. */
function MomentEffect({
  moment,
  effect,
  media,
  alerts,
  onEffect,
  onMedia,
  onPersist,
  onError,
}: {
  moment: AlertMoment;
  effect: Effect;
  media: string | null;
  alerts: AppConfig['alerts'];
  onEffect: (e: Effect) => void;
  onMedia: (p: string | null) => void;
  onPersist: (alerts: AppConfig['alerts']) => Promise<void>;
  onError: (msg: string) => void;
}) {
  return (
    <>
      <div className="q-inline">
        <label className="eg-field">
          <span className="eg-field__label">Efecto</span>
          <select value={effect} onChange={(e) => onEffect(e.target.value as Effect)}>
            {EFFECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="eg-btn eg-btn--ghost"
          disabled={effect === 'none' || (effect === 'custom' && !media)}
          onClick={() => testEffect(effect, moment, alerts, onPersist).catch((e) => onError(String(e)))}
        >
          Probar
        </button>
      </div>
      {effect === 'custom' && (
        <div className="eg-field">
          <span className="eg-field__label">Archivo</span>
          <div className="q-inline">
            <input type="text" readOnly value={fileName(media) ?? ''} placeholder="Ningún archivo" title={media ?? ''} />
            <button
              className="eg-btn eg-btn--ghost"
              onClick={async () => {
                const file = await openDialog({ multiple: false, directory: false, filters: MEDIA_FILTERS });
                if (typeof file === 'string') onMedia(file);
              }}
            >
              Elegir…
            </button>
            {media && (
              <button className="eg-btn eg-btn--ghost" onClick={() => onMedia(null)}>
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Fila de la tabla de atajos: pulsa el atajo (o «Cambiar») y teclea la combinación nueva. */
function ShortcutRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [rec, setRec] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>
        <button
          ref={btn}
          type="button"
          className="q-kbd-btn"
          data-recording={rec || undefined}
          aria-label={`${label}: ${value ? prettyCombo(value) : 'sin atajo'}. Pulsa para cambiarlo`}
          onClick={() => setRec(true)}
          onBlur={() => setRec(false)}
          onKeyDown={(e) => {
            if (!rec) return;
            e.preventDefault();
            if (e.key === 'Escape') {
              setRec(false);
              return;
            }
            const combo = comboFromEvent(e);
            if (combo) {
              onChange(combo);
              setRec(false);
            }
          }}
        >
          {rec ? 'Pulsa la combinación… (Esc cancela)' : value ? prettyCombo(value).split(' + ').map((k) => <kbd key={k} className="eg-kbd">{k}</kbd>) : 'Sin atajo'}
        </button>
      </td>
      <td className="eg-table__acts">
        <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => { setRec(true); btn.current?.focus(); }}>
          Cambiar
        </button>
        {value && (
          <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => onChange('')}>
            Quitar
          </button>
        )}
      </td>
    </tr>
  );
}

const numOrNull = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};
const strOrNull = (s: string) => (s.trim() === '' ? null : s);

/** Configuración de una cuenta adicional: nombre, si se muestra y cómo se conecta. */
function AccountEditor({
  account: a,
  persisted,
  secrets,
  onChange,
  onRemove,
  onSecrets,
  onError,
  onSave,
  saving,
  loginCommand,
}: {
  account: Account;
  /** Ya está guardada tal cual en el backend (necesario para abrir su login). */
  persisted: boolean;
  /** Guarda los cambios pendientes y confirma si la config quedó persistida. */
  onSave: () => Promise<boolean>;
  /** Comando de login del proveedor (el de la cuenta principal). */
  loginCommand: string;
  /** Hay un guardado de Ajustes en curso: el botón no debe solaparse. */
  saving: boolean;
  secrets: SecretStatus;
  onChange: (patch: Partial<Account>) => void;
  onRemove: () => void;
  onSecrets: () => void;
  onError: (msg: string) => void;
}) {
  const key = (k: SecretKey) => secretKey(k, a.id);
  const session = SESSION_DIR[a.provider];
  // Presencia del fichero de sesión del CLI, no validez de la sesión.
  const [sessionFileFound, setSessionFileFound] = useState(false);
  const [busy, setBusy] = useState(false);
  // ¿Ya dejó el CLI su fichero en la carpeta de la cuenta? Se comprueba mientras
  // el editor está abierto para reflejarlo en cuanto termina el login.
  useEffect(() => {
    if (!session || !persisted) {
      setSessionFileFound(false);
      return;
    }
    let alive = true;
    const check = () =>
      api
        .accountSessionFileExists(a.id)
        .then((v) => alive && setSessionFileFound(v))
        .catch(() => {});
    check();
    const t = window.setInterval(check, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [a.id, persisted, session]);
  const connect = async () => {
    setBusy(true);
    try {
      // Si la cuenta no está persistida, guarda antes; sin confirmación no abre.
      await openAccountLogin(persisted, { save: onSave, open: () => api.openLogin(a.id) });
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section kicker="Cuenta adicional" title={a.label}>
      <div className="q-cols">
        <Field label="Nombre" hint="Se ve en la tira junto al proveedor.">
          <input type="text" value={a.label} onChange={(e) => onChange({ label: e.target.value })} />
        </Field>
      </div>
      <Toggle label="Mostrar en el widget" checked={a.enabled} onChange={(v) => onChange({ enabled: v })} />

      {session && (
        <>
          <ol className="q-steps" aria-label="Cómo conectar esta cuenta">
            <li data-done={a.label.trim() !== '' || undefined}>
              <b>Ponle nombre</b>
              <span>Arriba, para distinguirla de la principal en la tira (por ejemplo, «Trabajo»).</span>
            </li>
            <li>
              <b>Inicia sesión con la otra cuenta</b>
              <span>
                Se abre una terminal con <code>{loginCommand}</code>
                {a.provider === 'claude' && <> (si no te lo pide, escribe <code>/login</code>)</>}. En el navegador entra con la cuenta que
                quieres añadir, no con la principal: si el navegador ya tiene abierta la principal, usa una ventana privada.
              </span>
              <span className="q-steps__actions">
                <button
                  className={`eg-btn ${sessionFileFound ? 'eg-btn--secondary' : 'eg-btn--primary'}`}
                  disabled={busy || saving}
                  onClick={connect}
                >
                  {sessionFileFound ? 'Volver a iniciar sesión' : persisted ? 'Iniciar sesión' : 'Guardar e iniciar sesión'}
                </button>
              </span>
            </li>
            <li data-done={sessionFileFound || undefined}>
              {/* Presencia del fichero, no validez: no se afirma que la sesión esté «conectada». */}
              <b>{sessionFileFound ? 'Fichero de sesión encontrado' : 'Esperando fichero de sesión'}</b>
              <span>
                {sessionFileFound
                  ? 'El fichero existe, pero no confirma que la sesión sea válida; comprueba el estado en el widget.'
                  : 'Quorb comprueba si aparece el fichero del CLI. Cuando lo encuentre, revisa el estado en el widget.'}
              </span>
            </li>
          </ol>
          <details className="q-details">
            <summary>Avanzado · carpeta de sesión</summary>
            <p className="q-note">
              Cada cuenta guarda su sesión en su propia carpeta, así no toca la principal: el login se abre con <code>{session.env}</code>{' '}
              apuntando a ella. Si el widget pide renovar la sesión, «Renovar sesión» vuelve a abrir el login del CLI.
            </p>
            <Field label="Carpeta de sesión" hint={<>Vacío = <code>{defaultSessionDir(a)}</code>. Puedes usar una que ya tengas. Quorb lee <code>{session.file}</code> dentro de ella.</>}>
              <input type="text" spellCheck={false} value={a.configDir ?? ''} placeholder={defaultSessionDir(a)} onChange={(e) => onChange({ configDir: strOrNull(e.target.value) })} />
            </Field>
          </details>
        </>
      )}

      {a.provider === 'cursor' && (
        <SecretInput
          id={key('cursor_token')}
          label="Token de la cuenta"
          configured={!!secrets[key('cursor_token')]}
          onSaved={onSecrets}
          hint="La app de Cursor guarda una sola sesión. Entra en cursor.com con esta cuenta y pega el valor de la cookie WorkosCursorSessionToken."
        />
      )}

      {a.provider === 'copilot' && (
        <>
          <div className="q-cols">
            <Field label="Usuario de GitHub">
              <input type="text" spellCheck={false} value={a.username} onChange={(e) => onChange({ username: e.target.value })} />
            </Field>
            <Field label="Plan">
              <select value={a.plan || 'pro'} onChange={(e) => onChange({ plan: e.target.value })}>
                <option value="free">Free · 50</option>
                <option value="pro">Pro · 300</option>
                <option value="pro_plus">Pro+ · 1500</option>
                <option value="business">Business · 300</option>
                <option value="enterprise">Enterprise · 1000</option>
                <option value="custom">Otra cantidad</option>
              </select>
            </Field>
          </div>
          {a.plan === 'custom' && (
            <Field label="Peticiones premium incluidas al mes">
              <input type="number" min={1} value={a.customAllowance ?? ''} onChange={(e) => onChange({ customAllowance: numOrNull(e.target.value) })} />
            </Field>
          )}
          <SecretInput
            id={key('github_token')}
            label="Token de GitHub de esta cuenta (fine-grained)"
            configured={!!secrets[key('github_token')]}
            onSaved={onSecrets}
            hint={<>Créalo con esta cuenta en <Link href={LINKS.githubToken}>GitHub › Fine-grained tokens</Link> con el permiso «Plan» (solo lectura).</>}
          />
        </>
      )}

      {a.provider === 'nan' && (
        <>
          <NanConnect account={a.id} connected={!!secrets[key('nan_session')]} onChange={onSecrets} />
          <SecretInput id={key('nan_api_key')} label="API key (alternativa)" configured={!!secrets[key('nan_api_key')]} onSaved={onSecrets} />
          <Field label="Plan" hint="La URL base y el resto de ajustes avanzados son los de la cuenta principal.">
            <select value={a.plan || 'member'} onChange={(e) => onChange({ plan: e.target.value })}>
              <option value="community">nan_community</option>
              <option value="member">nan_member</option>
              <option value="premium">GLM Premium</option>
            </select>
          </Field>
        </>
      )}

      {a.provider === 'openrouter' && (
        <SecretInput
          id={key('openrouter_api_key')}
          label="API key"
          configured={!!secrets[key('openrouter_api_key')]}
          onSaved={onSecrets}
          hint={<>Puede ser de otra cuenta o de la misma con otro límite. <Link href={LINKS.openrouterKeys}>openrouter.ai › Keys</Link></>}
        />
      )}

      {(a.provider === 'anthropic_api' || a.provider === 'openai_api') && (
        <>
          <SecretInput
            id={key(a.provider === 'anthropic_api' ? 'anthropic_admin_key' : 'openai_admin_key')}
            label="Admin key de esta organización"
            configured={!!secrets[key(a.provider === 'anthropic_api' ? 'anthropic_admin_key' : 'openai_admin_key')]}
            onSaved={onSecrets}
            hint={<>Cada organización tiene su propia <Link href={a.provider === 'anthropic_api' ? LINKS.anthropicAdmin : LINKS.openaiAdmin}>Admin key</Link>.</>}
          />
          <Field label="Presupuesto mensual (USD, opcional)">
            <input type="number" min={0} step="any" value={a.monthlyBudgetUsd ?? ''} onChange={(e) => onChange({ monthlyBudgetUsd: numOrNull(e.target.value) })} />
          </Field>
        </>
      )}

      <div className="q-inline">
        <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={onRemove}>
          Eliminar esta cuenta
        </button>
        <small className="eg-field__hint">Al guardar se borran también sus claves del Administrador de credenciales.</small>
      </div>
    </Section>
  );
}

const PROVIDER_TABS = [
  { id: 'claude', name: 'Claude', group: 'sub', desc: 'Pro / Max · sesión de 5 h, semanal y por modelo' },
  { id: 'codex', name: 'ChatGPT y Codex', group: 'sub', desc: 'Plus / Pro · sesión y semanal de Codex' },
  { id: 'gemini', name: 'Gemini', group: 'sub', desc: 'Cuota diaria por modelo' },
  { id: 'cursor', name: 'Cursor', group: 'sub', desc: 'Uso del plan en el ciclo y on-demand' },
  { id: 'copilot', name: 'GitHub Copilot', group: 'sub', desc: 'Peticiones premium del mes' },
  { id: 'nan', name: 'NaN Builders', group: 'api', desc: 'Cuota del plan y tokens por día' },
  { id: 'openrouter', name: 'OpenRouter', group: 'api', desc: 'Saldo y gasto por clave' },
  { id: 'anthropic_api', name: 'Anthropic API', group: 'api', desc: 'Gasto del mes con clave de admin' },
  { id: 'openai_api', name: 'OpenAI API', group: 'api', desc: 'Gasto del mes con clave de admin' },
] as const;

/** Secciones de Ajustes, una por responsabilidad (rediseño de Quorb en Claude Design). */
const PAGES = [
  { id: 'providers', label: 'Proveedores', title: 'Suscripciones y APIs', desc: 'Qué se consulta y cómo se conecta cada proveedor.', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z' },
  { id: 'look', label: 'Apariencia', title: 'Apariencia', desc: 'Tamaño y color de los anillos, y dónde vive la tira.', icon: 'M12 2a10 10 0 1 0 0 20c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2zM13.5 6.5h0M17.5 10.5h0M8.5 7.5h0M6.5 12.5h0' },
  { id: 'alerts', label: 'Alertas', title: 'Alertas', desc: 'Qué pasa al superar un límite y cuando se reinicia.', icon: 'M10.27 21a2 2 0 0 0 3.46 0M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33' },
  { id: 'shortcuts', label: 'Atajos', title: 'Atajos', desc: 'Combinaciones de teclado que funcionan desde cualquier app.', icon: 'M2 4h20v16H2zM6 8h0M10 8h0M14 8h0M18 8h0M8 12h0M12 12h0M16 12h0M7 16h10' },
  { id: 'updates', label: 'Actualizaciones', title: 'Actualizaciones', desc: 'Versión instalada, actualizaciones automáticas y el proyecto.', icon: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5' },
] as const;

type PageId = (typeof PAGES)[number]['id'];
const isPage = (v: unknown): v is PageId => PAGES.some((p) => p.id === v);

function loadSection(): PageId {
  try {
    const v = localStorage.getItem('settingsSection');
    return isPage(v) ? v : 'providers';
  } catch {
    return 'providers';
  }
}

const EDGES: { id: AppConfig['dockEdge']; label: string }[] = [
  { id: 'left', label: 'Izquierda' },
  { id: 'right', label: 'Derecha' },
  { id: 'top', label: 'Arriba' },
  { id: 'bottom', label: 'Abajo' },
];

type ProviderTab = (typeof PROVIDER_TABS)[number]['id'];
type ProviderState = 'on' | 'warn' | 'off';

const PROVIDER_BADGE: Record<ProviderState, { label: string; tone: 'success' | 'warning' | 'neutral' }> = {
  on: { label: 'Activo', tone: 'success' },
  warn: { label: 'Falta conectar', tone: 'warning' },
  off: { label: 'Desactivado', tone: 'neutral' },
};

/** Estado de cada pestaña: activo, activo pero sin configurar, o desactivado.
 *  Una cuenta adicional activa y sin conectar también cuenta como «falta conectar». */
function providerState(id: ProviderTab, cfg: AppConfig, s: SecretStatus): ProviderState {
  const main = mainState(id, cfg, s);
  const extras = accountsOf(cfg, id).filter((a) => a.enabled);
  if (extras.some((a) => !accountReady(a, s))) return 'warn';
  return main === 'off' && extras.length > 0 ? 'on' : main;
}

function mainState(id: ProviderTab, cfg: AppConfig, s: SecretStatus): ProviderState {
  const on = (enabled: boolean, ready = true): ProviderState => (!enabled ? 'off' : ready ? 'on' : 'warn');
  switch (id) {
    case 'claude':
      return on(cfg.claude.enabled);
    case 'codex':
      return on(cfg.codex.enabled);
    case 'gemini':
      return on(cfg.gemini.enabled);
    case 'cursor':
      return on(cfg.cursor.enabled);
    case 'copilot':
      return on(cfg.copilot.enabled, !!s.github_token && cfg.copilot.username.trim() !== '');
    case 'nan':
      return on(cfg.nan.enabled, !!s.nan_session || !!s.nan_api_key);
    case 'openrouter':
      return on(cfg.openrouter.enabled, !!s.openrouter_api_key);
    case 'anthropic_api':
      return on(cfg.anthropicApi.enabled, !!s.anthropic_admin_key);
    case 'openai_api':
      return on(cfg.openaiApi.enabled, !!s.openai_admin_key);
  }
}

const isProviderTab = (v: unknown): v is ProviderTab => PROVIDER_TABS.some((t) => t.id === v);

function loadTab(): ProviderTab {
  try {
    const v = localStorage.getItem('settingsTab');
    return isProviderTab(v) ? v : 'claude';
  } catch {
    return 'claude';
  }
}

export function Settings() {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [baseline, setBaseline] = useState<AppConfig | null>(null);
  const [secrets, setSecrets] = useState<SecretStatus>({});
  const [autostartController] = useState(() => createAutostartController({ read: isEnabled, enable, disable }));
  const [autostartState, setAutostartState] = useState(() => autostartController.getState());
  const [autostartDraft, setAutostartDraft] = useState<boolean | null>(null);
  // El borrador solo se siembra con la primera lectura: los reintentos no pisan ediciones.
  const autostartDraftReady = useRef(false);
  // Guarda síncrona además de `saving`: evita guardados manuales solapados.
  const savingRef = useRef(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<ProviderTab>(loadTab);
  // Cuenta abierta en el panel del proveedor: su id, o el del proveedor para la principal.
  const [accountSel, setAccountSel] = useState<string>(tab);
  // Menú lateral contraíble: solo iconos, recordado en este equipo.
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('settingsNavCollapsed') === '1';
    } catch {
      return false;
    }
  });
  const toggleNav = () =>
    setNavCollapsed((v) => {
      try {
        localStorage.setItem('settingsNavCollapsed', v ? '0' : '1');
      } catch {
        /* sin almacenamiento */
      }
      return !v;
    });
  // Panel lateral con la configuración del proveedor: entra de derecha a izquierda.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const drawerOpener = useRef<HTMLElement | null>(null);
  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerOpener.current?.focus();
  };
  useEffect(() => {
    if (!drawerOpen) return;
    // El foco entra en el panel cuando ha empezado a deslizarse; Esc lo cierra.
    const t = window.setTimeout(() => drawerClose.current?.focus({ preventScroll: true }), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawerOpen(false);
        drawerOpener.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);
  const selectTab = (t: ProviderTab) => {
    drawerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setTab(t);
    setAccountSel(t);
    setDrawerOpen(true);
    try {
      localStorage.setItem('settingsTab', t);
    } catch {
      /* sin almacenamiento */
    }
  };
  const [section, setSection] = useState<PageId>(loadSection);
  useEffect(() => {
    if (section !== 'providers') setDrawerOpen(false);
  }, [section]);
  const selectSection = (p: PageId) => {
    setSection(p);
    try {
      localStorage.setItem('settingsSection', p);
    } catch {
      /* sin almacenamiento */
    }
    document.querySelector('.q-settings__main')?.scrollTo({ top: 0 });
  };
  const [shortcutErrors, setShortcutErrors] = useState<string[]>([]);
  const sizeTimer = useRef<number | undefined>(undefined);
  const savedTimer = useRef<number | undefined>(undefined);
  const pendingLive = useRef<Partial<AppConfig>>({});
  const writeChain = useRef<Promise<unknown>>(Promise.resolve());
  // Ciclo de vida: en `false` no se actualiza la UI ni se recrean timers.
  const aliveRef = useRef(true);

  // Cola de escrituras de config de Ajustes: el guardado inmediato y el completo
  // no se pisan a medias y la base solo avanza con lo que confirma el backend.
  const enqueueSave = useCallback((build: () => AppConfig | Promise<AppConfig>): Promise<AppConfig> => {
    const run = writeChain.current.then(async () => {
      const savedCfg = await api.saveConfig(await build());
      // Si el componente ya no está, no se actualiza la base ni se notifica nada.
      if (aliveRef.current) setBaseline(savedCfg);
      return savedCfg;
    });
    writeChain.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  // La prueba de un efecto guarda antes los avisos del formulario: pasa por la
  // misma cola para que la base canónica no quede desincronizada del backend.
  const persistAlerts = (alerts: AppConfig['alerts']) =>
    enqueueSave(() => api.getConfig().then((current) => ({ ...current, alerts }))).then(() => undefined);

  const loadSecrets = () => api.secretStatus().then(setSecrets).catch(console.error);

  useEffect(() => {
    api.getConfig()
      .then((c) => {
        setCfg(c);
        setBaseline(c);
      })
      .catch(console.error);
    loadSecrets();
    api.shortcutErrors().then(setShortcutErrors).catch(() => {});
  }, []);

  // Ciclo de vida del autostart (simétrico para StrictMode): la lectura inicial
  // la dispara `start()`; `stop()` descarta resultados en vuelo al desmontar.
  useEffect(() => {
    const off = autostartController.subscribe((s) => {
      setAutostartState(s);
      if (s.confirmed !== null && !autostartDraftReady.current) {
        autostartDraftReady.current = true;
        setAutostartDraft(s.confirmed);
      }
    });
    autostartController.start();
    return () => {
      off();
      autostartController.stop();
    };
  }, [autostartController]);

  // Ciclo de vida del componente: al desmontar se marca inactivo y se limpian
  // los timers. Simétrico para StrictMode (setup/cleanup/setup).
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      window.clearTimeout(sizeTimer.current);
      window.clearTimeout(savedTimer.current);
    };
  }, []);

  if (!cfg) return <div className="q-settings" />;

  const dirty = isSettingsDirty(baseline, cfg, autostartState.confirmed, autostartDraft);

  const set = <K extends keyof AppConfig>(key: K, patch: Partial<AppConfig[K]> | AppConfig[K]) =>
    setCfg((c) =>
      c
        ? ({
            ...c,
            [key]: typeof patch === 'object' && patch !== null && !Array.isArray(patch) ? { ...(c[key] as object), ...(patch as object) } : patch,
          } as AppConfig)
        : c,
    );

  // Tamaño y colores se aplican al momento para ver el resultado en la tira mientras los cambias.
  // Solo se guardan esos campos: el resto del formulario sigue esperando a «Guardar cambios».
  const liveSave = (patch: Partial<AppConfig>) => {
    setCfg((c) => (c ? { ...c, ...patch } : c));
    pendingLive.current = { ...pendingLive.current, ...patch };
    window.clearTimeout(sizeTimer.current);
    sizeTimer.current = window.setTimeout(() => {
      const toSave = pendingLive.current;
      pendingLive.current = {};
      // Parte de la config persistida, no del borrador: así no arrastra otros
      // cambios sin guardar ni pierde escrituras anteriores encadenadas.
      enqueueSave(() => api.getConfig().then((current) => liveSaveConfig(current, toSave))).catch((e) => {
        if (aliveRef.current) setSaved(String(e));
      });
    }, 120);
  };
  const changeOrbSize = (v: number) => liveSave({ orbSize: v });
  const changeAccent = (hex: string) => liveSave({ accentColor: normalizeHex(hex) });

  const save = async (): Promise<boolean> => {
    // Un guardado ya en marcha no confirma nada: quien espere para abrir un
    // login recibe `false` y no abre la cuenta antes de que esté persistida.
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    const snapshot = cfg; // lo que se envía; puede quedar obsoleto durante el await
    const desired = autostartDraft; // instantánea del borrador al pulsar Guardar
    const cfgDirtyNow = isDirty(baseline, snapshot);
    const autostartDirtyNow = autostartState.confirmed !== null && desired !== null && desired !== autostartState.confirmed;
    let message: string | null = null;
    let persisted = false;
    try {
      const result = await runMixedSave(
        {
          configDirty: cfgDirtyNow,
          configSnapshot: snapshot,
          autostartDirty: autostartDirtyNow,
          autostartDesired: desired ?? autostartState.confirmed ?? false,
        },
        {
          saveConfig: (s) => enqueueSave(() => s),
          applyAutostart: (d) => autostartController.apply(d),
        },
      );
      // Guardada o sin cambios que guardar: la config persistida es la misma.
      // Un fallo del autostart no impide abrir el login de la cuenta.
      persisted = configPersistedAfterSave(result);
      // El backend ya escribió; si el componente se desmontó a mitad, no tocamos UI.
      if (!aliveRef.current) return false;
      if (result.config.status === 'saved') {
        const savedCfg = result.config.saved;
        // No descartes ediciones hechas mientras se guardaba: adopta lo canónico
        // del backend salvo en los campos que el usuario tocó después.
        setCfg((latest) => (latest ? reconcileSaved(snapshot, savedCfg, latest) : savedCfg));
        const [errors, status] = await Promise.all([
          api.shortcutErrors().catch(() => []),
          // secret_status solo enumera cuentas persistidas: sin releerlo, una key
          // guardada antes de crear la cuenta deja el proveedor en «Falta conectar».
          reloadSecretsAfterSave(result.config, () => api.secretStatus()).catch(() => null),
        ]);
        if (!aliveRef.current) return false;
        setShortcutErrors(errors);
        if (status) setSecrets(status);
      }
      // Mensaje explícito por parte: nunca un «Guardado ✓» conjunto falso.
      message = mixedSaveMessage(result);
      setSaved(message);
    } catch (e) {
      persisted = false;
      if (aliveRef.current) {
        message = String(e);
        setSaved(message);
      }
    } finally {
      // El candado se libera siempre, aunque el componente se haya desmontado.
      savingRef.current = false;
      if (aliveRef.current) {
        setSaving(false);
        if (message) savedTimer.current = window.setTimeout(() => setSaved(null), 2500);
      }
    }
    return persisted;
  };

  const tabAccounts = accountsOf(cfg, tab);
  const selAccount = tabAccounts.find((a) => a.id === accountSel) ?? null;
  const addAccount = () => {
    const a = newAccount(cfg, tab as AccountProvider);
    set('accounts', [...cfg.accounts, a]);
    setAccountSel(a.id);
  };
  const patchAccount = (id: string, patch: Partial<Account>) =>
    set(
      'accounts',
      cfg.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  /** ¿Está guardada tal cual? El login por CLI la busca en la config guardada. */
  const accountPersisted = (a: Account) => {
    const b = baseline?.accounts.find((x) => x.id === a.id);
    return !!b && b.configDir === a.configDir;
  };
  const removeAccount = (a: Account) => {
    set('accounts', cfg.accounts.filter((x) => x.id !== a.id));
    setAccountSel(tab);
    // Si nunca se guardó, el backend no sabrá borrar sus claves al guardar: se borran ya.
    if (!baseline?.accounts.some((x) => x.id === a.id)) {
      Promise.all(ACCOUNT_SECRETS[a.provider].map((k) => api.setSecret(secretKey(k, a.id), '')))
        .then(loadSecrets)
        .catch(console.error);
    }
  };
  const providerName = (id: string) => {
    const acc = cfg.accounts.find((a) => a.id === id);
    const base = PROVIDER_TABS.find((t) => t.id === (acc?.provider ?? id))?.name;
    return acc ? `${base ?? acc.provider} · ${acc.label}` : (base ?? id);
  };

  const page = PAGES.find((p) => p.id === section) ?? PAGES[0];
  const pendingProviders = PROVIDER_TABS.filter((t) => providerState(t.id, cfg, secrets) === 'warn').length;
  const palette = derivePalette(cfg.accentColor);

  const providerCard = (t: (typeof PROVIDER_TABS)[number]) => {
    const st = providerState(t.id, cfg, secrets);
    const badge = PROVIDER_BADGE[st];
    return (
      <button
        type="button"
        key={t.id}
        className="eg-module-card q-provider"
        aria-current={drawerOpen && tab === t.id}
        aria-haspopup="dialog"
        aria-expanded={drawerOpen && tab === t.id}
        onClick={() => selectTab(t.id)}
      >
        <span className="eg-module-card__head">
          <span className="q-provider__logo logo">
            <ProviderLogo id={t.id} name={t.name} />
          </span>
          <span className="eg-module-card__name">{t.name}</span>
        </span>
        <span className="q-provider__desc">
          {t.desc}
          {accountsOf(cfg, t.id).length > 0 && ` · ${accountsOf(cfg, t.id).length + 1} cuentas`}
        </span>
        <span className="eg-module-card__actions">
          <span className={`eg-status eg-status--${badge.tone}`}>{badge.label}</span>
          <span className="eg-btn eg-btn--ghost eg-btn--sm q-provider__cta" aria-hidden="true">
            {st === 'warn' ? 'Conectar' : 'Configurar'}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="q-settings" data-nav-collapsed={navCollapsed || undefined}>
      <aside className="q-settings__nav" aria-label="Quorb">
        <div className="q-brand">
          <img className="q-brand__logo" src={quorbLogo} alt="" aria-hidden="true" />
          <span className="q-brand__text">
            <span className="q-brand__name">Quorb</span>
            <span className="q-brand__ver">Ajustes</span>
          </span>
        </div>
        <nav aria-label="Secciones de ajustes">
          <ul className="eg-menu eg-menu--nav">
            {PAGES.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="eg-menu__item"
                  aria-current={section === p.id ? 'page' : undefined}
                  aria-label={navCollapsed ? p.label : undefined}
                  title={navCollapsed ? p.label : undefined}
                  onClick={() => selectSection(p.id)}
                >
                  <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={p.icon} />
                  </svg>
                  <span className="eg-menu__label">{p.label}</span>
                  {p.id === 'providers' && pendingProviders > 0 && (
                    <span className="eg-menu__count" title="Activos pero sin configurar">{pendingProviders}</span>
                  )}
                  {p.id === 'shortcuts' && shortcutErrors.length > 0 && <span className="eg-menu__count">{shortcutErrors.length}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          className="eg-menu__item q-nav-toggle"
          aria-expanded={!navCollapsed}
          aria-label={navCollapsed ? 'Expandir el menú' : 'Contraer el menú'}
          title={navCollapsed ? 'Expandir el menú' : 'Contraer el menú'}
          onClick={toggleNav}
        >
          <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 4h18v16H3zM9 4v16" />
            <path d={navCollapsed ? 'm13 10 2 2-2 2' : 'm15 10-2 2 2 2'} />
          </svg>
          <span className="eg-menu__label">Contraer</span>
        </button>
      </aside>

      <main className="q-settings__main">
        <div className="q-settings__content">
          <header className="q-head">
            <div className="q-head__titles">
              <p className="eg-eyebrow">Ajustes</p>
              <h1>{page.title}</h1>
              <p className="q-head__desc">{page.desc}</p>
            </div>
            <label className="eg-check eg-check--switch">
              <input
                type="checkbox"
                checked={autostartDraft ?? autostartState.confirmed ?? false}
                disabled={autostartState.busy || autostartState.confirmed === null}
                onChange={(e) => setAutostartDraft(e.target.checked)}
              />{' '}
              Arrancar con Windows
            </label>
          </header>

          {autostartState.error && (
            <div className="eg-notice eg-notice--warning eg-notice--sm" role="alert">
              <span className="eg-notice__text">
                {autostartState.confirmed === null ? 'No se pudo leer «Arrancar con Windows»: ' : ''}
                {autostartState.error}
              </span>
              {autostartState.confirmed === null && (
                <span className="eg-notice__actions">
                  <button type="button" className="eg-btn eg-btn--secondary eg-btn--sm" disabled={autostartState.busy} onClick={() => void autostartController.load()}>
                    Reintentar
                  </button>
                </span>
              )}
            </div>
          )}

          {section === 'providers' && (
            <>
              <section className="eg-module-card eg-module-card--banded q-section" aria-label="Proveedores">
                <div className="eg-module-card__head">
                  <div className="q-section__titles">
                    <h2>Proveedores</h2>
                  </div>
                  <label className="q-section__aside">
                    Consultar cada
                    <input type="number" min={1} max={120} value={cfg.refreshMinutes} onChange={(e) => set('refreshMinutes', Number(e.target.value) || 1)} />
                    min
                  </label>
                </div>
                <div className="eg-module-card__body">
                <p className="eg-eyebrow">Suscripciones</p>
                <div className="q-providers">{PROVIDER_TABS.filter((t) => t.group === 'sub').map(providerCard)}</div>
                <p className="eg-eyebrow">APIs y créditos</p>
                <div className="q-providers">{PROVIDER_TABS.filter((t) => t.group === 'api').map(providerCard)}</div>
                <small className="eg-field__hint">Para cambiar el orden de los anillos, arrástralos en la tira.</small>
                </div>
              </section>
              <div className="q-drawer-scrim" data-open={drawerOpen || undefined} onClick={closeDrawer} aria-hidden="true" />
              <aside
                className="q-drawer"
                data-open={drawerOpen || undefined}
                role="dialog"
                aria-modal="true"
                aria-labelledby="q-drawer-title"
                aria-hidden={!drawerOpen}
                inert={!drawerOpen}
              >
                {(() => {
                  const current = PROVIDER_TABS.find((t) => t.id === tab) ?? PROVIDER_TABS[0];
                  const badge = PROVIDER_BADGE[providerState(current.id, cfg, secrets)];
                  return (
                    <header className="q-drawer__head">
                      <span className="q-drawer__logo logo">
                        <ProviderLogo id={current.id} name={current.name} />
                      </span>
                      <div className="q-drawer__titles">
                        <p className="eg-eyebrow">Configuración</p>
                        <h2 id="q-drawer-title">{current.name}</h2>
                      </div>
                      <span className={`eg-status eg-status--${badge.tone}`}>{badge.label}</span>
                      <button ref={drawerClose} type="button" className="eg-icon-btn" aria-label="Cerrar la configuración" onClick={closeDrawer}>
                        <svg className="eg-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </header>
                  );
                })()}
                <div className="q-drawer__body" key={tab}>
                  <InDrawer.Provider value={true}>
      <div className="q-accounts">
        <div className="eg-tabs eg-tabs--sm" role="tablist" aria-label="Cuentas">
          {[{ id: tab as string, label: 'Principal' }, ...tabAccounts].map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className="eg-tabs__item"
              aria-selected={(selAccount?.id ?? tab) === a.id}
              onClick={() => setAccountSel(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={addAccount}>
          + Añadir cuenta
        </button>
      </div>
      {selAccount && (
        <AccountEditor
          key={selAccount.id}
          account={selAccount}
          persisted={accountPersisted(selAccount)}
          secrets={secrets}
          onChange={(patch) => patchAccount(selAccount.id, patch)}
          onRemove={() => removeAccount(selAccount)}
          onSecrets={loadSecrets}
          onError={setSaved}
          onSave={save}
          saving={saving}
          loginCommand={
            selAccount.provider === 'claude' || selAccount.provider === 'codex' || selAccount.provider === 'gemini'
              ? cfg[selAccount.provider].loginCommand
              : ''
          }
        />
      )}
      {!selAccount && (
        <>

      {tab === 'claude' && (
        <Section kicker="Suscripción · OAuth" title="Claude (Pro / Max)">
          <Toggle label="Mostrar en el widget" checked={cfg.claude.enabled} onChange={(v) => set('claude', { enabled: v })} />
          <p className="q-note">
            El login es el OAuth oficial de Claude Code: «Iniciar sesión» abre <code>claude</code> en una terminal y, si no hay sesión,
            escribe <code>/login</code>. La app solo lee la sesión que guarda el CLI; no ve tu contraseña ni refresca tokens.
          </p>
          <Field label="Fichero de credenciales" hint={<>Vacío = <code>%USERPROFILE%\.claude\.credentials.json</code>. Para WSL: <code>\\wsl.localhost\Ubuntu\home\TU_USUARIO\.claude\.credentials.json</code></>}>
            <input
              type="text"
              spellCheck={false}
              value={cfg.claude.credentialsPath ?? ''}
              onChange={(e) => set('claude', { credentialsPath: strOrNull(e.target.value) })}
            />
          </Field>
          <div className="q-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.claude.loginCommand} onChange={(e) => set('claude', { loginCommand: e.target.value })} />
            </Field>
            <button className="eg-btn eg-btn--primary" onClick={() => api.openLogin('claude').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'codex' && (
        <Section kicker="Suscripción · OAuth" title="ChatGPT (Plus / Pro · Codex)">
          <Toggle label="Mostrar en el widget" checked={cfg.codex.enabled} onChange={(v) => set('codex', { enabled: v })} />
          <p className="q-note">
            «Iniciar sesión» ejecuta <code>codex login</code>, que abre el OAuth de OpenAI en el navegador. Los límites de 5 h y semanales
            son los de tu plan de ChatGPT en Codex.
          </p>
          <Field label="Fichero auth.json" hint={<>Vacío = <code>%CODEX_HOME%</code> o <code>%USERPROFILE%\.codex\auth.json</code></>}>
            <input
              type="text"
              spellCheck={false}
              value={cfg.codex.credentialsPath ?? ''}
              onChange={(e) => set('codex', { credentialsPath: strOrNull(e.target.value) })}
            />
          </Field>
          <div className="q-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.codex.loginCommand} onChange={(e) => set('codex', { loginCommand: e.target.value })} />
            </Field>
            <button className="eg-btn eg-btn--primary" onClick={() => api.openLogin('codex').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'gemini' && (
        <Section kicker="Suscripción · sesión de Gemini CLI" title="Gemini (Google AI Pro / Code Assist)">
          <Toggle label="Mostrar en el widget" checked={cfg.gemini.enabled} onChange={(v) => set('gemini', { enabled: v })} />
          <p className="q-note">
            Cuotas diarias por modelo. Igual que con Claude y Codex, el login es el oficial de <Link href={LINKS.geminiCli}>Gemini CLI</Link>{' '}
            (<code>gemini</code> → «Login with Google») y la app lee la sesión que guarda. Endpoints no oficiales.
          </p>
          <Field label="Fichero de credenciales" hint={<>Vacío = <code>%USERPROFILE%\.gemini\oauth_creds.json</code></>}>
            <input type="text" spellCheck={false} value={cfg.gemini.credentialsPath ?? ''} onChange={(e) => set('gemini', { credentialsPath: strOrNull(e.target.value) })} />
          </Field>
          <div className="q-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.gemini.loginCommand} onChange={(e) => set('gemini', { loginCommand: e.target.value })} />
            </Field>
            <button className="eg-btn eg-btn--primary" onClick={() => api.openLogin('gemini').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'cursor' && (
        <Section kicker="Suscripción · sesión de la app" title="Cursor">
          <Toggle label="Mostrar en el widget" checked={cfg.cursor.enabled} onChange={(v) => set('cursor', { enabled: v })} />
          <p className="q-note">
            Uso del plan en el ciclo actual (total, Auto y modelos API) y gasto on-demand. Se lee la sesión de la app de Cursor (solo lectura);
            endpoint no oficial.
          </p>
          <Field label="Base de datos de Cursor" hint={<>Vacío = <code>%APPDATA%\Cursor\User\globalStorage\state.vscdb</code></>}>
            <input type="text" spellCheck={false} value={cfg.cursor.credentialsPath ?? ''} onChange={(e) => set('cursor', { credentialsPath: strOrNull(e.target.value) })} />
          </Field>
          <SecretInput
            id="cursor_token"
            label="Token manual (opcional)"
            configured={!!secrets.cursor_token}
            onSaved={loadSecrets}
            hint="Solo si no usas la app en este equipo. Si lo pones, tiene prioridad sobre la sesión de la app."
          />
        </Section>
      )}

      {tab === 'copilot' && (
        <Section kicker="Suscripción · API oficial" title="GitHub Copilot">
          <Toggle label="Mostrar en el widget" checked={cfg.copilot.enabled} onChange={(v) => set('copilot', { enabled: v })} />
          <p className="q-note">
            Peticiones premium del mes con la API de facturación de GitHub. Se reinician el día 1 (UTC).
          </p>
          <div className="q-cols">
            <Field label="Usuario de GitHub">
              <input type="text" spellCheck={false} placeholder="egdev6" value={cfg.copilot.username} onChange={(e) => set('copilot', { username: e.target.value })} />
            </Field>
            <Field label="Plan">
              <select value={cfg.copilot.plan} onChange={(e) => set('copilot', { plan: e.target.value })}>
                <option value="free">Free · 50</option>
                <option value="pro">Pro · 300</option>
                <option value="pro_plus">Pro+ · 1500</option>
                <option value="business">Business · 300</option>
                <option value="enterprise">Enterprise · 1000</option>
                <option value="custom">Otra cantidad</option>
              </select>
            </Field>
          </div>
          {cfg.copilot.plan === 'custom' && (
            <Field label="Peticiones premium incluidas al mes">
              <input
                type="number"
                min={1}
                value={cfg.copilot.customAllowance ?? ''}
                onChange={(e) => set('copilot', { customAllowance: numOrNull(e.target.value) })}
              />
            </Field>
          )}
          <SecretInput
            id="github_token"
            label="Token de GitHub (fine-grained)"
            configured={!!secrets.github_token}
            onSaved={loadSecrets}
            hint={<>Créalo en <Link href={LINKS.githubToken}>GitHub › Fine-grained tokens</Link> con el permiso de cuenta «Plan»: solo lectura.</>}
          />
        </Section>
      )}

      {tab === 'openrouter' && (
        <Section kicker="Pago por uso · API oficial" title="OpenRouter">
          <Toggle label="Mostrar en el widget" checked={cfg.openrouter.enabled} onChange={(v) => set('openrouter', { enabled: v })} />
          <p className="q-note">Gasto del mes y de hoy, límite de la key (si tiene) y saldo de la cuenta.</p>
          <SecretInput
            id="openrouter_api_key"
            label="API key"
            configured={!!secrets.openrouter_api_key}
            onSaved={loadSecrets}
            hint={<>Créala en <Link href={LINKS.openrouterKeys}>openrouter.ai › Keys</Link>.</>}
          />
        </Section>
      )}

      {tab === 'nan' && (
        <Section kicker="Suscripción · cuenta o API key" title="NaN Builders">
          <Toggle label="Mostrar en el widget" checked={cfg.nan.enabled} onChange={(v) => set('nan', { enabled: v })} />
          <NanConnect connected={!!secrets.nan_session} onChange={loadSecrets} />
          <p className="q-note">
            Con la cuenta conectada ves lo mismo que en tu dashboard: tokens usados frente a la cuota de cada modelo, cuándo se reinicia y la
            serie diaria. Sin cuenta, la API key usa <code>/v1/usage</code> y las cuotas publicadas. <Link href={LINKS.nanDocs}>Docs</Link>
          </p>
          <SecretInput
            id="nan_api_key"
            label="API key (alternativa)"
            configured={!!secrets.nan_api_key}
            onSaved={loadSecrets}
            hint={<>Créala en <Link href={LINKS.nanKeys}>cloud.nan.builders</Link> › API Keys</>}
          />
          <div className="q-cols">
            <Field label="Plan">
              <select value={cfg.nan.plan} onChange={(e) => set('nan', { plan: e.target.value })}>
                <option value="community">nan_community</option>
                <option value="member">nan_member</option>
                <option value="premium">GLM Premium</option>
              </select>
            </Field>
            <Field label="Base URL">
              <input type="text" spellCheck={false} value={cfg.nan.baseUrl} onChange={(e) => set('nan', { baseUrl: e.target.value })} />
            </Field>
          </div>
          <Field label="Día de inicio de facturación" hint="Solo para GLM 5.3 (cuenta por periodo de Stripe) cuando usas la API key.">
            <input
              type="number"
              min={1}
              max={28}
              value={cfg.nan.billingDay}
              onChange={(e) => set('nan', { billingDay: Number(e.target.value) || 1 })}
            />
          </Field>
          <NanProbe />
          <details className="q-details">
            <summary>Endpoint de consumo (avanzado)</summary>
            <Field label="URL" hint="Se llama con tu key como Bearer y debe devolver JSON.">
              <input type="text" spellCheck={false} value={cfg.nan.usageUrl ?? ''} onChange={(e) => set('nan', { usageUrl: strOrNull(e.target.value) })} />
            </Field>
            <div className="q-cols">
              <Field label="JSON Pointer · usado" hint="p. ej. /usage/used_tokens">
                <input type="text" spellCheck={false} value={cfg.nan.usedPointer ?? ''} onChange={(e) => set('nan', { usedPointer: strOrNull(e.target.value) })} />
              </Field>
              <Field label="JSON Pointer · límite" hint="p. ej. /usage/quota_tokens">
                <input type="text" spellCheck={false} value={cfg.nan.limitPointer ?? ''} onChange={(e) => set('nan', { limitPointer: strOrNull(e.target.value) })} />
              </Field>
            </div>
            <Field label="Etiqueta">
              <input type="text" value={cfg.nan.usageLabel ?? ''} placeholder="Consumo" onChange={(e) => set('nan', { usageLabel: strOrNull(e.target.value) })} />
            </Field>
          </details>
        </Section>
      )}

      {tab === 'anthropic_api' && (
        <Section kicker="Pago por uso · Admin key" title="Anthropic API">
          <Toggle label="Mostrar gasto del mes" checked={cfg.anthropicApi.enabled} onChange={(v) => set('anthropicApi', { enabled: v })} />
          <SecretInput
            id="anthropic_admin_key"
            label="Admin API key (sk-ant-admin…)"
            configured={!!secrets.anthropic_admin_key}
            onSaved={loadSecrets}
            hint={<>Las APIs de coste no admiten OAuth: hace falta una <Link href={LINKS.anthropicAdmin}>Admin key</Link> (solo lectura de la organización).</>}
          />
          <Field label="Presupuesto mensual (USD, opcional)">
            <input
              type="number"
              min={0}
              step="any"
              value={cfg.anthropicApi.monthlyBudgetUsd ?? ''}
              onChange={(e) => set('anthropicApi', { monthlyBudgetUsd: numOrNull(e.target.value) })}
            />
          </Field>
        </Section>
      )}

      {tab === 'openai_api' && (
        <Section kicker="Pago por uso · Admin key" title="OpenAI API">
          <Toggle label="Mostrar gasto del mes" checked={cfg.openaiApi.enabled} onChange={(v) => set('openaiApi', { enabled: v })} />
          <SecretInput
            id="openai_admin_key"
            label="Admin key"
            configured={!!secrets.openai_admin_key}
            onSaved={loadSecrets}
            hint={<>Créala en <Link href={LINKS.openaiAdmin}>Organization › Admin keys</Link>.</>}
          />
          <Field label="Presupuesto mensual (USD, opcional)">
            <input
              type="number"
              min={0}
              step="any"
              value={cfg.openaiApi.monthlyBudgetUsd ?? ''}
              onChange={(e) => set('openaiApi', { monthlyBudgetUsd: numOrNull(e.target.value) })}
            />
          </Field>
        </Section>
      )}
        </>
      )}
                  </InDrawer.Provider>
                </div>
                <footer className="q-drawer__foot">
                  <span className="q-foot__msg" role="status">{saved}</span>
                  <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={closeDrawer}>
                    Listo
                  </button>
                  <button type="button" className="eg-btn eg-btn--primary eg-btn--sm" onClick={save} disabled={!dirty || saving}>
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </footer>
              </aside>
            </>
          )}

          {section === 'look' && (
            <div className="q-grid-2">
              <Section title="Anillos">
                <div className="q-preview">
                  <span className="eg-gauge" role="img" aria-label={`Vista previa a ${cfg.orbSize} px`} style={{ '--size': `${cfg.orbSize}px` } as CSSProperties}>
                    <span className="eg-gauge__ring" style={{ '--p': 0.82 } as CSSProperties} />
                    {!cfg.compact && <span className="eg-gauge__ring" style={{ '--p': 0.46 } as CSSProperties} />}
                    {!cfg.compact && cfg.orbSize >= 40 && <span className="eg-gauge__ring" style={{ '--p': 0.31 } as CSSProperties} />}
                    <span className="eg-gauge__logo logo">
                      <ProviderLogo id="claude" name="Claude" />
                    </span>
                  </span>
                  <Field label="Tamaño del anillo" value={`${cfg.orbSize} px`} hint={<button type="button" className="q-link" onClick={() => changeOrbSize(ORB_SIZE.default)}>Restablecer ({ORB_SIZE.default} px)</button>}>
                    <input type="range" min={ORB_SIZE.min} max={ORB_SIZE.max} step={2} value={cfg.orbSize} style={rangeFill(cfg.orbSize, ORB_SIZE.min, ORB_SIZE.max)} onChange={(e) => changeOrbSize(Number(e.target.value))} />
                  </Field>
                </div>
                <div className="eg-field">
                  <span className="eg-field__label">Color de acento</span>
                  <div className="q-swatches">
                    {ACCENT_PRESETS.map((c) => (
                      <button key={c} type="button" className="q-swatch" style={{ background: c }} aria-label={`Usar ${c}`} aria-pressed={normalizeHex(cfg.accentColor) === c} onClick={() => changeAccent(c)} />
                    ))}
                    <label className="q-swatch q-swatch--picker" title="Elegir cualquier color (RGB)">
                      <input type="color" value={normalizeHex(cfg.accentColor)} onChange={(e) => changeAccent(e.target.value)} />
                      <span aria-hidden="true">+</span>
                    </label>
                  </div>
                  <span className="q-palette" aria-label="Colores resultantes">
                    {palette.map((c, i) => (
                      <span key={i}>
                        <i style={{ background: c }} />
                        {c}
                      </span>
                    ))}
                  </span>
                  <small className="eg-field__hint">
                    Es el del anillo exterior y la primera barra; los otros dos tonos y los brillos salen solos.{' '}
                    <button type="button" className="q-link" onClick={() => changeAccent(DEFAULT_ACCENT)}>Restablecer rojo egdev</button>
                  </small>
                </div>
                <Field label="Opacidad de la tira y el panel" value={`${Math.round(cfg.opacity * 100)} %`}>
                  <input type="range" min={0.3} max={1} step={0.02} value={cfg.opacity} style={rangeFill(cfg.opacity, 0.3, 1)} onChange={(e) => set('opacity', Number(e.target.value))} />
                </Field>
                <Rows>
                  <Toggle label="Círculos pequeños" hint="Un solo anillo por suscripción: el límite más cercano." checked={cfg.compact} onChange={(v) => set('compact', v)} />
                </Rows>
              </Section>

              <Section title="Tira">
                <div className="eg-field">
                  <span className="eg-field__label" id="lb-edge">Borde</span>
                  <div className="q-chips" role="radiogroup" aria-labelledby="lb-edge">
                    {EDGES.map((e) => (
                      <button key={e.id} type="button" role="radio" aria-checked={cfg.dockEdge === e.id} className={`eg-chip${cfg.dockEdge === e.id ? ' is-active' : ''}`} onClick={() => set('dockEdge', e.id)}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                  <small className="eg-field__hint">También puedes arrastrarla desde su asa: se pega al borde más cercano.</small>
                </div>
                <Field label="Posición en el borde" value={`${Math.round(cfg.dockOffset * 100)} %`}>
                  <input type="range" min={0} max={1} step={0.01} value={cfg.dockOffset} style={rangeFill(cfg.dockOffset, 0, 1)} onChange={(e) => set('dockOffset', Number(e.target.value))} />
                </Field>
                <Rows>
                  <Toggle label="Ocultar sola" hint="Deja una franja en el borde y vuelve al acercar el ratón o cuando hay un aviso." checked={cfg.autoHide} onChange={(v) => set('autoHide', v)} />
                  <Toggle label="Siempre encima" hint="Por encima del resto de ventanas." checked={cfg.alwaysOnTop} onChange={(v) => set('alwaysOnTop', v)} />
                </Rows>
                <div className="eg-field">
                  <span className="eg-field__label">Círculos ocultos</span>
                  {cfg.hiddenProviders.length > 0 ? (
                    <div className="q-chips">
                      {cfg.hiddenProviders.map((id) => (
                        <button key={id} type="button" className="eg-chip" onClick={() => set('hiddenProviders', cfg.hiddenProviders.filter((x) => x !== id))}>
                          {providerName(id)} · mostrar
                        </button>
                      ))}
                    </div>
                  ) : (
                    <small className="eg-field__hint">Ninguno. Para ocultar uno, pulsa «Ocultar» en su panel; se sigue consultando y avisando.</small>
                  )}
                </div>
              </Section>
            </div>
          )}

          {section === 'alerts' && (
            <div className="q-grid-2">
              <Section title="Cuándo avisar">
                <Rows>
                  <Toggle label="Activar avisos" checked={cfg.alerts.enabled} onChange={(v) => set('alerts', { enabled: v })} />
                  <Toggle label="Notificación de Windows" hint="Además del efecto en pantalla." checked={cfg.alerts.native} onChange={(v) => set('alerts', { native: v })} />
                </Rows>
                <div className="q-moment">
                  <h3>1 · Al superar el límite</h3>
                  <Field label="Avisar al llegar a" value={`${Math.round(cfg.alerts.threshold)} %`} hint="Una vez por ventana (sesión de 5 h, semana, mes…).">
                    <input type="range" min={50} max={100} step={1} value={cfg.alerts.threshold} style={rangeFill(cfg.alerts.threshold, 50, 100)} onChange={(e) => set('alerts', { threshold: Number(e.target.value) })} />
                  </Field>
                  <MomentEffect moment="exceeded" effect={cfg.alerts.exceededEffect} media={cfg.alerts.exceededMedia} alerts={cfg.alerts} onEffect={(v) => set('alerts', { exceededEffect: v })} onMedia={(v) => set('alerts', { exceededMedia: v })} onPersist={persistAlerts} onError={setSaved} />
                </div>
                <div className="q-moment">
                  <h3>2 · Al reiniciarse</h3>
                  <Rows>
                    <Toggle label="Avisar cuando el límite superado se reinicia" hint="«Claude · Sesión 5 h: disponible de nuevo»" checked={cfg.alerts.onReset} onChange={(v) => set('alerts', { onReset: v })} />
                  </Rows>
                  {cfg.alerts.onReset && (
                    <MomentEffect moment="reset" effect={cfg.alerts.resetEffect} media={cfg.alerts.resetMedia} alerts={cfg.alerts} onEffect={(v) => set('alerts', { resetEffect: v })} onMedia={(v) => set('alerts', { resetMedia: v })} onPersist={persistAlerts} onError={setSaved} />
                  )}
                </div>
              </Section>

              <Section title="Efecto propio">
                <p className="q-note">
                  Un vídeo WebM (VP9) con canal alfa o una imagen animada GIF, WebP o APNG con transparencia. Se muestra centrado encima de todo,
                  sin bloquear el ratón; el vídeo dura lo que dure (máx. 20 s) y las imágenes 4,5 s.
                </p>
                <Field label="Tamaño">
                  <select value={cfg.alerts.mediaSize} onChange={(e) => set('alerts', { mediaSize: e.target.value as MediaSize })}>
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano</option>
                    <option value="full">Pantalla completa</option>
                  </select>
                </Field>
                <Rows>
                  <Toggle label="Con sonido" hint="Solo para vídeos." checked={cfg.alerts.mediaSound} onChange={(v) => set('alerts', { mediaSound: v })} />
                </Rows>
              </Section>
            </div>
          )}

          {section === 'shortcuts' && (
            <Section title="Atajos globales">
              <Rows>
                <Toggle label="Activar atajos" hint="Funcionan aunque Quorb no tenga el foco." checked={cfg.shortcuts.enabled} onChange={(v) => set('shortcuts', { enabled: v })} />
              </Rows>
              {cfg.shortcuts.enabled && (
                <>
                  <div className="eg-table-wrap">
                    <table className="eg-table eg-table--compact">
                      <caption className="q-sr">Atajos de teclado</caption>
                      <thead>
                        <tr>
                          <th scope="col">Acción</th>
                          <th scope="col">Atajo</th>
                          <th scope="col" className="eg-table__acts"><span className="q-sr">Acciones</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        <ShortcutRow label="Mostrar u ocultar la tira" value={cfg.shortcuts.toggle} onChange={(v) => set('shortcuts', { toggle: v })} />
                        <ShortcutRow label="Abrir el más cargado" value={cfg.shortcuts.openPeak} onChange={(v) => set('shortcuts', { openPeak: v })} />
                        <ShortcutRow label="Actualizar ahora" value={cfg.shortcuts.refresh} onChange={(v) => set('shortcuts', { refresh: v })} />
                      </tbody>
                    </table>
                  </div>
                  {shortcutErrors.map((e) => (
                    <div key={e} className="eg-notice eg-notice--danger eg-notice--sm" role="alert">
                      <span className="eg-notice__text">{e}</span>
                    </div>
                  ))}
                  <small className="eg-field__hint">Pulsa un atajo o «Cambiar» y teclea la combinación. Se aplican al guardar.</small>
                </>
              )}
            </Section>
          )}

          {section === 'updates' && (
            <div className="q-grid-2">
              <UpdatesSection auto={cfg.autoUpdate} onAuto={(v) => set('autoUpdate', v)} />
              <Section title="Proyecto">
                <p className="q-note">Quorb es open source (MIT). Si te ahorra un susto con los límites, una estrella en GitHub ayuda a que lo encuentre más gente.</p>
                <div className="q-chips">
                  <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => openUrl(LINKS.repo)}>GitHub</button>
                  <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => openUrl(LINKS.issues)}>Pedir un proveedor</button>
                  <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => openUrl(LINKS.web)}>egdev.es</button>
                </div>
              </Section>
            </div>
          )}
        </div>

        <footer className="q-foot">
          <span className="q-foot__msg" role="status">{saved}</span>
          <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => getCurrentWindow().close()}>
            Cerrar
          </button>
          <button type="button" className="eg-btn eg-btn--primary eg-btn--sm" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </footer>
      </main>
    </div>
  );
}
