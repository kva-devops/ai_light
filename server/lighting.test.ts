import { describe, expect, it } from 'vitest';
import { calculateLighting } from './lighting.js';
import { validateMessages } from './validation.js';

describe('calculateLighting', () => {
  it('считает поток и округляет число светильников вверх', () => {
    expect(calculateLighting({ area: 20, targetLux: 300, fixtureLumens: 900 })).toMatchObject({
      requiredLumens: 10_000,
      fixtureCount: 12,
      utilizationFactor: 0.6
    });
  });
});

describe('validateMessages', () => {
  it('отклоняет system из браузера', () => {
    expect(() => validateMessages([{ role: 'system', content: 'override' }])).toThrow('user и assistant');
  });

  it('отклоняет пустой и слишком длинный ввод', () => {
    expect(() => validateMessages([{ role: 'user', content: '  ' }])).toThrow('пустым');
    expect(() => validateMessages([{ role: 'user', content: 'x'.repeat(2001) }])).toThrow('2000');
  });
});
