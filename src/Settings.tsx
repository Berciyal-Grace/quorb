import { useEffect, useRef, useState, type ReactNode } from 'react';
import { currentMonitor, getCurrentWindow } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { openUrl } from '@tauri-apps/plugin-opener';
import { getVersion } from '@tauri-apps/api/app';
import { api } from './lib/api';
import { ORB_SIZE, type AlertMoment, type AppConfig, type Effect, type MediaSize, type SecretKey, type SecretStatus } from './lib/types';
import { ACCENT_PRESETS, DEFAULT_ACCENT, derivePalette, normalizeHex } from './lib/palette';
import { comboFromEvent, prettyCombo } from './lib/shortcuts';
import { ProviderLogo } from './components/ProviderLogo';
import { checkForUpdate, installUpdate, updateErrorText, type UpdatePhase } from './lib/updater';

const LINKS = {
  anthropicAdmin: 'https://console.anthropic.com/settings/admin-keys',
  openaiAdmin: 'https://platform.openai.com/settings/organization/admin-keys',
  nanKeys: 'https://cloud.nan.builders/',
  nanDocs: 'https://nan.builders/docs',
  githubToken: 'https://github.com/settings/personal-access-tokens/new',
  openrouterKeys: 'https://openrouter.ai/settings/keys',
  geminiCli: 'https://github.com/google-gemini/gemini-cli',
  releases: 'https://github.com/egdev6/quorb/releases',
};

function Section({ title, kicker, children }: { title: string; kicker?: string; children: ReactNode }) {
  return (
    <section className="s-section">
      {kicker && <p className="kicker">{kicker}</p>}
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function UpdatesSection({ auto, onAuto }: { auto: boolean; onAuto: (v: boolean) => void }) {
  const [version, setVersion] = useState<string>('');
  const [state, setState] = useState<UpdatePhase>({ phase: 'idle' });
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);

  const checkNow = async () => {
    setState({ phase: 'checking' });
    try {
      const info = await checkForUpdate();
      setState(info ? { phase: 'available', info } : { phase: 'none', checkedAt: Date.now() });
    } catch (e) {
      setState({ phase: 'error', message: updateErrorText(e) });
    }
  };
  const install = async () => {
    if (state.phase !== 'available') return;
    const info = state.info;
    setState({ phase: 'installing', info, progress: null });
    try {
      await installUpdate((progress) => setState({ phase: 'installing', info, progress }));
    } catch (e) {
      setState({ phase: 'error', message: updateErrorText(e) });
    }
  };

  return (
    <Section kicker="Versión" title="Actualizaciones">
      <div className="s-update">
        <span className="s-update__version">Quorb {version ? `v${version}` : ''}</span>
        <button className="btn" disabled={state.phase === 'checking' || state.phase === 'installing'} onClick={checkNow}>
          {state.phase === 'checking' ? 'Buscando…' : 'Buscar ahora'}
        </button>
      </div>
      {state.phase === 'none' && <small className="s-field__hint">Estás en la última versión.</small>}
      {state.phase === 'error' && <small className="s-field__hint s-field__hint--warn">{state.message}</small>}
      {(state.phase === 'available' || state.phase === 'installing') && (
        <div className="s-update__card">
          <div className="s-update">
            <strong>Nueva versión {state.info.version}</strong>
            <button className="btn btn--accent" disabled={state.phase === 'installing'} onClick={install}>
              {state.phase === 'installing'
                ? `Instalando${state.progress != null ? ` · ${state.progress} %` : '…'}`
                : 'Instalar y reiniciar'}
            </button>
          </div>
          {state.phase === 'installing' && (
            <div className="s-update__bar" aria-hidden="true">
              <span style={{ width: `${state.progress ?? 15}%` }} data-indeterminate={state.progress == null || undefined} />
            </div>
          )}
          {state.info.notes && <pre className="s-update__notes">{state.info.notes}</pre>}
        </div>
      )}
      <Toggle
        label="Buscar actualizaciones automáticamente"
        hint="Al arrancar y cada 6 h. Si hay una nueva, aparece un icono de descarga en la tira."
        checked={auto}
        onChange={onAuto}
      />
      <small className="s-field__hint">
        Las actualizaciones llegan firmadas desde{' '}
        <button type="button" className="s-link" onClick={() => openUrl(LINKS.releases)}>
          GitHub Releases
        </button>
        ; si la firma no coincide, no se instalan.
      </small>
    </Section>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="s-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="s-toggle__ui" aria-hidden="true" />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="s-field">
      <span className="s-field__label">{label}</span>
      {children}
      {hint && <small className="s-field__hint">{hint}</small>}
    </label>
  );
}

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

function SecretInput({ id, label, configured, onSaved, hint }: { id: SecretKey; label: string; configured: boolean; onSaved: () => void; hint?: ReactNode }) {
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
      <div className="s-inline">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={configured ? '•••••••• (configurada)' : 'Pega aquí la key'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn btn--accent" disabled={busy || !value.trim()} onClick={() => save(value)}>
          Guardar
        </button>
        {configured && (
          <button className="btn" disabled={busy} onClick={() => save('')} title="Eliminar key">
            Quitar
          </button>
        )}
      </div>
    </Field>
  );
}

/** Conectar NaN Cloud como la CLI oficial: enlace de un solo uso enviado al correo. */
function NanConnect({ connected, onChange }: { connected: boolean; onChange: () => void }) {
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
      <div className="s-connected">
        <span className="s-connected__dot" /> Cuenta de NaN Cloud conectada{msg ? ` · ${msg}` : ''}
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api.setSecret('nan_session', '');
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
    <div className="s-field">
      <span className="s-field__label">Conectar tu cuenta (recomendado)</span>
      {step === 'email' ? (
        <div className="s-inline">
          <input type="email" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="btn btn--accent"
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
        <div className="s-inline">
          <input type="text" spellCheck={false} placeholder="https://…nan.builders/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <button
            className="btn btn--accent"
            disabled={busy || !link.trim()}
            onClick={() =>
              run(async () => {
                const who = await api.nanLoginComplete(link);
                setMsg(`Conectado como ${who}`);
                setLink('');
                onChange();
              })
            }
          >
            Conectar
          </button>
          <button className="btn" disabled={busy} onClick={() => setStep('email')}>
            Volver
          </button>
        </div>
      )}
      <small className="s-field__hint">
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
    <details className="s-details">
      <summary>Probar la API de NaN con la key</summary>
      <button
        className="btn"
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
      {out && <pre className="s-pre">{out}</pre>}
    </details>
  );
}

const EFFECT_OPTIONS: { value: Effect; label: string }[] = [
  { value: 'confetti', label: 'Confeti' },
  { value: 'glow', label: 'Glow de peligro' },
  { value: 'custom', label: 'Efecto propio (vídeo o imagen animada)' },
  { value: 'none', label: 'Ninguno' },
];

async function testEffect(kind: Effect, moment: AlertMoment, alerts: AppConfig['alerts']) {
  if (kind === 'none') return;
  // El archivo del efecto propio se lee de la config guardada: guardamos antes lo que haya en el formulario.
  const current = await api.getConfig();
  await api.saveConfig({ ...current, alerts });
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
  onError,
}: {
  moment: AlertMoment;
  effect: Effect;
  media: string | null;
  alerts: AppConfig['alerts'];
  onEffect: (e: Effect) => void;
  onMedia: (p: string | null) => void;
  onError: (msg: string) => void;
}) {
  return (
    <>
      <div className="s-inline">
        <label className="s-field">
          <span className="s-field__label">Efecto</span>
          <select value={effect} onChange={(e) => onEffect(e.target.value as Effect)}>
            {EFFECT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn s-inline__btn"
          disabled={effect === 'none' || (effect === 'custom' && !media)}
          onClick={() => testEffect(effect, moment, alerts).catch((e) => onError(String(e)))}
        >
          Probar
        </button>
      </div>
      {effect === 'custom' && (
        <div className="s-field">
          <span className="s-field__label">Archivo</span>
          <div className="s-inline">
            <input type="text" readOnly value={fileName(media) ?? ''} placeholder="Ningún archivo" title={media ?? ''} />
            <button
              className="btn"
              onClick={async () => {
                const file = await openDialog({ multiple: false, directory: false, filters: MEDIA_FILTERS });
                if (typeof file === 'string') onMedia(file);
              }}
            >
              Elegir…
            </button>
            {media && (
              <button className="btn" onClick={() => onMedia(null)}>
                Quitar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Campo que graba una combinación de teclas al pulsarla. */
function ShortcutInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [rec, setRec] = useState(false);
  return (
    <Field label={label}>
      <div className="s-inline">
        <input
          type="text"
          readOnly
          className="s-kbd"
          data-recording={rec || undefined}
          value={rec ? 'Pulsa la combinación… (Esc cancela)' : value ? prettyCombo(value) : 'Sin atajo'}
          onFocus={() => setRec(true)}
          onBlur={() => setRec(false)}
          onKeyDown={(e) => {
            if (!rec) return;
            e.preventDefault();
            if (e.key === 'Escape') {
              e.currentTarget.blur();
              return;
            }
            const combo = comboFromEvent(e);
            if (combo) {
              onChange(combo);
              e.currentTarget.blur();
            }
          }}
        />
        {value && (
          <button className="btn" onClick={() => onChange('')}>
            Quitar
          </button>
        )}
      </div>
    </Field>
  );
}

const numOrNull = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return s.trim() === '' || Number.isNaN(n) ? null : n;
};
const strOrNull = (s: string) => (s.trim() === '' ? null : s);

const PROVIDER_TABS = [
  { id: 'claude', name: 'Claude' },
  { id: 'codex', name: 'ChatGPT' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'cursor', name: 'Cursor' },
  { id: 'copilot', name: 'Copilot' },
  { id: 'nan', name: 'NaN' },
  { id: 'openrouter', name: 'OpenRouter' },
  { id: 'anthropic_api', name: 'Anthropic API' },
  { id: 'openai_api', name: 'OpenAI API' },
] as const;

type ProviderTab = (typeof PROVIDER_TABS)[number]['id'];
type ProviderState = 'on' | 'warn' | 'off';

const STATE_LABEL: Record<ProviderState, string> = {
  on: 'Activo',
  warn: 'Activo, falta configurar',
  off: 'Desactivado',
};

/** Estado de cada pestaña: activo, activo pero sin configurar, o desactivado. */
function providerState(id: ProviderTab, cfg: AppConfig, s: SecretStatus): ProviderState {
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
  const [secrets, setSecrets] = useState<SecretStatus>({});
  const [autostart, setAutostart] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [tab, setTab] = useState<ProviderTab>(loadTab);
  const selectTab = (t: ProviderTab) => {
    setTab(t);
    try {
      localStorage.setItem('settingsTab', t);
    } catch {
      /* sin almacenamiento */
    }
  };
  const [shortcutErrors, setShortcutErrors] = useState<string[]>([]);
  const sizeTimer = useRef<number | undefined>(undefined);
  const pendingLive = useRef<Partial<AppConfig>>({});

  const loadSecrets = () => api.secretStatus().then(setSecrets).catch(console.error);

  useEffect(() => {
    api.getConfig().then(setCfg).catch(console.error);
    loadSecrets();
    api.shortcutErrors().then(setShortcutErrors).catch(() => {});
    isEnabled().then(setAutostart).catch(() => setAutostart(false));
  }, []);

  if (!cfg) return <div className="settings">Cargando…</div>;

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
    sizeTimer.current = window.setTimeout(async () => {
      const toSave = pendingLive.current;
      pendingLive.current = {};
      try {
        const current = await api.getConfig();
        await api.saveConfig({ ...current, ...toSave });
      } catch (e) {
        setSaved(String(e));
      }
    }, 120);
  };
  const changeOrbSize = (v: number) => liveSave({ orbSize: v });
  const changeAccent = (hex: string) => liveSave({ accentColor: normalizeHex(hex) });

  const save = async () => {
    try {
      setCfg(await api.saveConfig(cfg));
      setShortcutErrors(await api.shortcutErrors().catch(() => []));
      setSaved('Guardado ✓');
    } catch (e) {
      setSaved(String(e));
    }
    window.setTimeout(() => setSaved(null), 2500);
  };

  const toggleAutostart = async (v: boolean) => {
    try {
      if (v) await enable();
      else await disable();
      setAutostart(await isEnabled());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="settings">
      <header className="settings__head">
        <span className="brand">
          <span className="brand__mark" aria-hidden="true" />
          QUORB
        </span>
        <h1>Ajustes</h1>
      </header>

      <Section title="General">
        <div className="s-grid">
          <Field label="Refrescar cada (min)">
            <input
              type="number"
              min={1}
              max={120}
              value={cfg.refreshMinutes}
              onChange={(e) => set('refreshMinutes', Number(e.target.value) || 1)}
            />
          </Field>
          <Field label={`Opacidad · ${Math.round(cfg.opacity * 100)}%`}>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.02}
              value={cfg.opacity}
              onChange={(e) => set('opacity', Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Borde de la pantalla" hint="También puedes arrastrar la tira desde su asa: se pega al borde más cercano.">
          <select value={cfg.dockEdge} onChange={(e) => set('dockEdge', e.target.value as AppConfig['dockEdge'])}>
            <option value="top">Arriba</option>
            <option value="bottom">Abajo</option>
            <option value="left">Izquierda</option>
            <option value="right">Derecha</option>
          </select>
        </Field>
        <Field label={`Posición en el borde · ${Math.round(cfg.dockOffset * 100)}%`}>
          <input type="range" min={0} max={1} step={0.01} value={cfg.dockOffset} onChange={(e) => set('dockOffset', Number(e.target.value))} />
        </Field>
        <Field
          label={`Tamaño de los círculos · ${cfg.orbSize} px`}
          hint={
            <span className="s-range-hint">
              <span>{ORB_SIZE.min} px</span>
              <button type="button" className="s-link" onClick={() => changeOrbSize(ORB_SIZE.default)}>
                Restablecer ({ORB_SIZE.default} px)
              </button>
              <span>{ORB_SIZE.max} px</span>
            </span>
          }
        >
          <input
            type="range"
            min={ORB_SIZE.min}
            max={ORB_SIZE.max}
            step={2}
            value={cfg.orbSize}
            onChange={(e) => changeOrbSize(Number(e.target.value))}
          />
        </Field>
        <div className="s-field">
          <span className="s-field__label">Color de anillos y barras</span>
          <div className="s-colors">
            {ACCENT_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="s-swatch"
                style={{ background: c }}
                aria-label={`Usar ${c}`}
                aria-pressed={normalizeHex(cfg.accentColor) === c}
                onClick={() => changeAccent(c)}
              />
            ))}
            <label className="s-swatch s-swatch--picker" title="Elegir cualquier color (RGB)">
              <input type="color" value={normalizeHex(cfg.accentColor)} onChange={(e) => changeAccent(e.target.value)} />
              <span aria-hidden="true">+</span>
            </label>
          </div>
          <div className="s-palette" aria-label="Colores resultantes">
            {derivePalette(cfg.accentColor).map((c, i) => (
              <span key={i} className="s-palette__chip">
                <span className="s-palette__ring" style={{ borderColor: c }} />
                <span className="s-palette__bar" style={{ background: c }} />
                <code>{c}</code>
              </span>
            ))}
          </div>
          <small className="s-field__hint">
            El color elegido es el del anillo exterior y la primera barra; los otros dos tonos salen automáticos.{' '}
            <button type="button" className="s-link" onClick={() => changeAccent(DEFAULT_ACCENT)}>
              Restablecer rojo egdev
            </button>
          </small>
        </div>
        <Toggle label="Siempre encima" checked={cfg.alwaysOnTop} onChange={(v) => set('alwaysOnTop', v)} />
        <Toggle label="Círculos pequeños" hint="Un solo anillo por suscripción (el límite más cercano)" checked={cfg.compact} onChange={(v) => set('compact', v)} />
        <Toggle label="Arrancar con Windows" checked={autostart} onChange={toggleAutostart} />
        <Toggle
          label="Ocultar automáticamente"
          hint="Deja solo una franja en el borde; aparece al acercar el ratón o cuando hay un aviso"
          checked={cfg.autoHide}
          onChange={(v) => set('autoHide', v)}
        />
        {cfg.hiddenProviders.length > 0 && (
          <div className="s-field">
            <span className="s-field__label">Círculos ocultos</span>
            <div className="s-colors">
              {cfg.hiddenProviders.map((id) => (
                <button key={id} className="chip" onClick={() => set('hiddenProviders', cfg.hiddenProviders.filter((x) => x !== id))}>
                  {id} · mostrar
                </button>
              ))}
            </div>
            <small className="s-field__hint">Se siguen consultando y avisando aunque no se vean. Para reordenar, arrastra los círculos en la tira.</small>
          </div>
        )}
      </Section>

      <UpdatesSection auto={cfg.autoUpdate} onAuto={(v) => set('autoUpdate', v)} />

      <Section kicker="Teclado" title="Atajos globales">
        <Toggle label="Activar atajos" hint="Funcionan aunque la app no tenga el foco" checked={cfg.shortcuts.enabled} onChange={(v) => set('shortcuts', { enabled: v })} />
        {cfg.shortcuts.enabled && (
          <>
            <ShortcutInput label="Mostrar / ocultar la tira" value={cfg.shortcuts.toggle} onChange={(v) => set('shortcuts', { toggle: v })} />
            <ShortcutInput label="Abrir el detalle del más cargado" value={cfg.shortcuts.openPeak} onChange={(v) => set('shortcuts', { openPeak: v })} />
            <ShortcutInput label="Actualizar ahora" value={cfg.shortcuts.refresh} onChange={(v) => set('shortcuts', { refresh: v })} />
            {shortcutErrors.length > 0 && (
              <ul className="s-errors">
                {shortcutErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <small className="s-field__hint">Haz clic en un campo y pulsa la combinación. Se aplican al guardar.</small>
          </>
        )}
      </Section>

      <Section kicker="Avisos" title="Avisos y efectos">
        <Toggle label="Activar avisos" checked={cfg.alerts.enabled} onChange={(v) => set('alerts', { enabled: v })} />
        <Toggle label="Notificación de Windows" hint="Además del efecto en pantalla" checked={cfg.alerts.native} onChange={(v) => set('alerts', { native: v })} />

        <div className="s-moment">
          <h3 className="s-moment__title">1 · Al superar el límite</h3>
          <Field label={`Se considera superado a partir de · ${Math.round(cfg.alerts.threshold)} %`} hint="Se avisa una vez por ventana (sesión de 5 h, semana, mes…).">
            <input type="range" min={50} max={100} step={1} value={cfg.alerts.threshold} onChange={(e) => set('alerts', { threshold: Number(e.target.value) })} />
          </Field>
          <MomentEffect
            moment="exceeded"
            effect={cfg.alerts.exceededEffect}
            media={cfg.alerts.exceededMedia}
            alerts={cfg.alerts}
            onEffect={(v) => set('alerts', { exceededEffect: v })}
            onMedia={(v) => set('alerts', { exceededMedia: v })}
            onError={setSaved}
          />
        </div>

        <div className="s-moment">
          <h3 className="s-moment__title">2 · Al reiniciarse</h3>
          <Toggle
            label="Avisar cuando el límite superado se reinicia"
            hint="«Claude · Sesión 5 h: disponible de nuevo»"
            checked={cfg.alerts.onReset}
            onChange={(v) => set('alerts', { onReset: v })}
          />
          {cfg.alerts.onReset && (
            <MomentEffect
              moment="reset"
              effect={cfg.alerts.resetEffect}
              media={cfg.alerts.resetMedia}
              alerts={cfg.alerts}
              onEffect={(v) => set('alerts', { resetEffect: v })}
              onMedia={(v) => set('alerts', { resetMedia: v })}
              onError={setSaved}
            />
          )}
        </div>

        {(cfg.alerts.exceededEffect === 'custom' || cfg.alerts.resetEffect === 'custom') && (
          <div className="s-grid">
            <Field label="Tamaño del efecto propio">
              <select value={cfg.alerts.mediaSize} onChange={(e) => set('alerts', { mediaSize: e.target.value as MediaSize })}>
                <option value="small">Pequeño</option>
                <option value="medium">Mediano</option>
                <option value="full">Pantalla completa</option>
              </select>
            </Field>
            <Toggle label="Con sonido (vídeo)" checked={cfg.alerts.mediaSound} onChange={(v) => set('alerts', { mediaSound: v })} />
          </div>
        )}
        <p className="s-note">
          <strong>Efecto propio:</strong> un vídeo WebM (VP9) con canal alfa o una imagen animada GIF, WebP o APNG con transparencia. Se
          muestra centrado encima de todo, sin bloquear el ratón; el vídeo dura lo que dure (máx. 20 s) y las imágenes 4,5 s.
        </p>
      </Section>

      <section className="s-section s-providers">
        <p className="kicker">Proveedores</p>
        <h2>Suscripciones y APIs</h2>
        <div className="ptabs" role="tablist" aria-label="Proveedores">
          {PROVIDER_TABS.map((t) => {
            const st = providerState(t.id, cfg, secrets);
            return (
              <button
                key={t.id}
                role="tab"
                className="ptab"
                aria-selected={tab === t.id}
                data-state={st}
                onClick={() => selectTab(t.id)}
                title={STATE_LABEL[st]}
              >
                <span className="ptab__logo logo">
                  <ProviderLogo id={t.id} name={t.name} />
                </span>
                <span className="ptab__name">{t.name}</span>
                <span className="ptab__dot" aria-label={STATE_LABEL[st]} />
              </button>
            );
          })}
        </div>
      </section>

      <div className="s-provider" role="tabpanel">
      {tab === 'claude' && (
        <Section kicker="Suscripción · OAuth" title="Claude (Pro / Max)">
          <Toggle label="Mostrar en el widget" checked={cfg.claude.enabled} onChange={(v) => set('claude', { enabled: v })} />
          <p className="s-note">
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
          <div className="s-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.claude.loginCommand} onChange={(e) => set('claude', { loginCommand: e.target.value })} />
            </Field>
            <button className="btn btn--accent s-inline__btn" onClick={() => api.openLogin('claude').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'codex' && (
        <Section kicker="Suscripción · OAuth" title="ChatGPT (Plus / Pro · Codex)">
          <Toggle label="Mostrar en el widget" checked={cfg.codex.enabled} onChange={(v) => set('codex', { enabled: v })} />
          <p className="s-note">
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
          <div className="s-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.codex.loginCommand} onChange={(e) => set('codex', { loginCommand: e.target.value })} />
            </Field>
            <button className="btn btn--accent s-inline__btn" onClick={() => api.openLogin('codex').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'gemini' && (
        <Section kicker="Suscripción · sesión de Gemini CLI" title="Gemini (Google AI Pro / Code Assist)">
          <Toggle label="Mostrar en el widget" checked={cfg.gemini.enabled} onChange={(v) => set('gemini', { enabled: v })} />
          <p className="s-note">
            Cuotas diarias por modelo. Igual que con Claude y Codex, el login es el oficial de <Link href={LINKS.geminiCli}>Gemini CLI</Link>{' '}
            (<code>gemini</code> → «Login with Google») y la app lee la sesión que guarda. Endpoints no oficiales.
          </p>
          <Field label="Fichero de credenciales" hint={<>Vacío = <code>%USERPROFILE%\.gemini\oauth_creds.json</code></>}>
            <input type="text" spellCheck={false} value={cfg.gemini.credentialsPath ?? ''} onChange={(e) => set('gemini', { credentialsPath: strOrNull(e.target.value) })} />
          </Field>
          <div className="s-inline">
            <Field label="Comando de login">
              <input type="text" spellCheck={false} value={cfg.gemini.loginCommand} onChange={(e) => set('gemini', { loginCommand: e.target.value })} />
            </Field>
            <button className="btn btn--accent s-inline__btn" onClick={() => api.openLogin('gemini').catch((e) => setSaved(String(e)))}>
              Iniciar sesión
            </button>
          </div>
        </Section>
      )}

      {tab === 'cursor' && (
        <Section kicker="Suscripción · sesión de la app" title="Cursor">
          <Toggle label="Mostrar en el widget" checked={cfg.cursor.enabled} onChange={(v) => set('cursor', { enabled: v })} />
          <p className="s-note">
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
          <p className="s-note">
            Peticiones premium del mes con la API de facturación de GitHub. Se reinician el día 1 (UTC).
          </p>
          <div className="s-grid">
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
          <p className="s-note">Gasto del mes y de hoy, límite de la key (si tiene) y saldo de la cuenta.</p>
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
          <p className="s-note">
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
          <div className="s-grid">
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
          <details className="s-details">
            <summary>Endpoint de consumo (avanzado)</summary>
            <Field label="URL" hint="Se llama con tu key como Bearer y debe devolver JSON.">
              <input type="text" spellCheck={false} value={cfg.nan.usageUrl ?? ''} onChange={(e) => set('nan', { usageUrl: strOrNull(e.target.value) })} />
            </Field>
            <div className="s-grid">
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
      </div>

      <footer className="settings__foot">
        <span className="settings__saved" role="status">{saved}</span>
        <button className="btn" onClick={() => getCurrentWindow().close()}>
          Cerrar
        </button>
        <button className="btn btn--accent" onClick={save}>
          Guardar cambios
        </button>
      </footer>
    </div>
  );
}
