import { describe, expect, it } from 'vitest';
import { defaultSessionDir, newAccount, providerOf, secretKey } from './accounts';
import type { AppConfig } from './types';

const cfg = (accounts: AppConfig['accounts'] = []) => ({ accounts, nan: { plan: 'premium' } }) as unknown as AppConfig;

describe('accounts', () => {
  it('maps report ids to their provider', () => {
    expect(providerOf('claude')).toBe('claude');
    expect(providerOf('claude:abc123')).toBe('claude');
  });

  it('scopes secrets only for extra accounts', () => {
    expect(secretKey('openrouter_api_key', 'openrouter')).toBe('openrouter_api_key');
    expect(secretKey('openrouter_api_key', 'openrouter:abc123')).toBe('openrouter_api_key@openrouter:abc123');
  });

  it('creates accounts with unique ids and sensible defaults', () => {
    const a = newAccount(cfg(), 'copilot', () => 0);
    expect(a).toMatchObject({ id: 'copilot:000000', label: 'Cuenta 2', enabled: true, plan: 'pro' });
    let n = 0;
    const b = newAccount(cfg([a]), 'copilot', () => (n++ === 0 ? 0 : 0.5));
    expect(b.id).not.toBe(a.id);
    expect(b.label).toBe('Cuenta 3');
    expect(b.id).toMatch(/^copilot:[a-z0-9]{6}$/);
    expect(newAccount(cfg(), 'nan').plan).toBe('premium');
  });

  it('shows the default session folder', () => {
    expect(defaultSessionDir({ id: 'claude:w1', provider: 'claude' })).toBe('%USERPROFILE%\\.quorb\\accounts\\claude-w1');
  });
});
