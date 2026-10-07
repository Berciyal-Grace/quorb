import { describe, expect, it } from 'vitest';
import { scopeSvg } from './svg';

describe('scopeSvg', () => {
  it('prefixes ids, references and style classes', () => {
    const svg =
      '<svg><defs><style>.st0{fill:#eee;opacity:.5}</style><linearGradient id="a"/></defs>' +
      '<path class="st0 big" fill="url(#a)"/><use href="#a"/><use xlink:href="#a"/></svg>';
    const out = scopeSvg('microsoft-copilot', svg);
    expect(out).toContain('id="microsoft-copilot__a"');
    expect(out).toContain('fill="url(#microsoft-copilot__a)"');
    expect(out).toContain('<use href="#microsoft-copilot__a"/>');
    expect(out).toContain('xlink:href="#microsoft-copilot__a"');
    expect(out).toContain('class="microsoft-copilot__st0 microsoft-copilot__big"');
    expect(out).toContain('.microsoft-copilot__st0{fill:#eee;opacity:.5}');
  });

  it('keeps two logos with the same ids apart', () => {
    const a = scopeSvg('gemini', '<mask id="a"/>');
    const b = scopeSvg('cursor', '<mask id="a"/>');
    expect(a === b).toBe(false);
  });
});
