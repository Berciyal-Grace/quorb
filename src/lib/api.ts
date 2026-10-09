import { invoke } from '@tauri-apps/api/core';
import type { AlertMoment, AppConfig, Effect, Sample, ScopedSecretKey, SecretStatus, UsageReport } from './types';

export const api = {
  getConfig: () => invoke<AppConfig>('get_config'),
  saveConfig: (config: AppConfig) => invoke<AppConfig>('save_config', { config }),
  secretStatus: () => invoke<SecretStatus>('secret_status'),
  setSecret: (key: ScopedSecretKey, value: string) => invoke<void>('set_secret', { key, value }),
  fetchUsage: () => invoke<UsageReport[]>('fetch_usage'),
  openLogin: (provider: string) => invoke<void>('open_login', { provider }),
  openSettings: () => invoke<void>('open_settings'),
  showDetail: () => invoke<boolean>('show_detail'),
  setTrayTooltip: (text: string) => invoke<void>('set_tray_tooltip', { text }),
  getHistory: (provider: string, hours: number) => invoke<Sample[]>('get_history', { provider, hours }),
  nanProbe: () => invoke<string>('nan_probe'),
  nanLoginRequest: (email: string) => invoke<void>('nan_login_request', { email }),
  /** Devuelve el usuario conectado. `account`: id de una cuenta adicional de NaN */
  nanLoginComplete: (link: string, account?: string) => invoke<string>('nan_login_complete', { link, account: account ?? null }),
  /** Rectángulo del monitor en píxeles físicos */
  playEffect: (
    kind: Exclude<Effect, 'none'>,
    moment: AlertMoment,
    rect: { x: number; y: number; width: number; height: number },
  ) => invoke<void>('play_effect', { req: { kind, moment, ...rect } }),
  overlayDone: () => invoke<void>('overlay_done'),
  shortcutErrors: () => invoke<string[]>('shortcut_errors'),
};
