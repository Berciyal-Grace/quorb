import { describe, expect, it } from 'vitest';
import type { AppConfig } from './types';
import { isDirty, liveSaveConfig, reconcileSaved } from './settings-dirty';

const alerts = (over: Partial<AppConfig['alerts']> = {}): AppConfig['alerts'] => ({
  enabled: true,
  native: false,
  threshold: 90,
  exceededEffect: 'none',
  onReset: false,
  resetEffect: 'none',
  exceededMedia: null,
  resetMedia: null,
  mediaSize: 'medium',
  mediaSound: false,
  ...over,
});

const config = (over: Record<string, unknown> = {}): AppConfig =>
  ({ refreshMinutes: 5, orbSize: 48, accentColor: '#ff0036', providerOrder: ['claude', 'codex'], hiddenProviders: [], alerts: alerts(), ...over }) as unknown as AppConfig;

describe('isDirty', () => {
  it('is false without a canonical baseline, true after an edit and false again on revert', () => {
    const base = config();
    expect(isDirty(null, base)).toBe(false);
    expect(isDirty(base, null)).toBe(false);
    expect(isDirty(base, { ...base })).toBe(false);
    const edited = { ...base, refreshMinutes: 30, alerts: alerts({ native: true }) };
    expect(isDirty(base, edited)).toBe(true);
    expect(isDirty(base, { ...base, providerOrder: ['codex', 'claude'] })).toBe(true);
    expect(isDirty(base, { ...edited, refreshMinutes: base.refreshMinutes, alerts: alerts() })).toBe(false);
  });
});

describe('liveSaveConfig', () => {
  it('persists only the live field from the canonical baseline', () => {
    const base = config();
    const saved = liveSaveConfig(base, { orbSize: 60 });
    expect(saved.orbSize).toBe(60);
    expect(saved.refreshMinutes).toBe(5);
    expect(isDirty(saved, { ...base, orbSize: 60, refreshMinutes: 30 })).toBe(true);
  });
});

describe('reconcileSaved', () => {
  it('adopts the canonical saved values when the draft did not change', () => {
    const base = config({ accentColor: '#AAA' });
    expect(reconcileSaved(base, config({ accentColor: '#aaa' }), base).accentColor).toBe('#aaa');
  });

  it('keeps a live edit made during the save without losing canonical fields', () => {
    const base = config({ orbSize: 48, accentColor: '#AAA' });
    const saved = config({ orbSize: 48, accentColor: '#aaa' });
    const latest = config({ orbSize: 60, accentColor: '#AAA' });
    expect(reconcileSaved(base, saved, latest)).toEqual({ ...saved, orbSize: 60 });
  });

  it('merges nested edits field by field and keeps arrays edited during the save', () => {
    const base = config({ alerts: alerts({ threshold: 90, native: false }) });
    const saved = config({ alerts: alerts({ threshold: 80 }) });
    const latest = config({ alerts: alerts({ threshold: 90, native: true }), providerOrder: ['codex', 'claude'] });
    const out = reconcileSaved(base, saved, latest);
    expect(out.alerts.threshold).toBe(80);
    expect(out.alerts.native).toBe(true);
    expect(out.providerOrder).toEqual(['codex', 'claude']);
  });
});
