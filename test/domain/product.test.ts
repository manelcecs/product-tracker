import { describe, expect, it } from 'vitest';
import { isProductMatch, ProductIdentity } from '../../src/domain/product';

const identity: ProductIdentity = {
  name: 'Nintendo Switch 2 - The Legend of Zelda 40th Anniversary Edition',
  ean: '0045496337292',
  mpn: '10019448',
  requiredKeywords: ['nintendo switch 2', 'zelda', '40'],
  excludedKeywords: ['funda', 'mando', 'case'],
};

describe('isProductMatch', () => {
  it('matches on an exact EAN regardless of the text', () => {
    expect(isProductMatch(identity, 'some unrelated title', { ean: '0045496337292' })).toBe(true);
  });

  it('matches on an exact MPN regardless of the text', () => {
    expect(isProductMatch(identity, 'some unrelated title', { mpn: '10019448' })).toBe(true);
  });

  it('matches via required keywords when no identifiers are given', () => {
    expect(isProductMatch(identity, 'Consola Nintendo Switch 2 Edicion Zelda 40 Aniversario')).toBe(true);
  });

  it('rejects text missing a required keyword', () => {
    expect(isProductMatch(identity, 'Consola Nintendo Switch 2 Estandar')).toBe(false);
  });

  it('rejects text containing an excluded keyword even if required keywords match', () => {
    expect(isProductMatch(identity, 'Funda Nintendo Switch 2 Zelda 40 Aniversario')).toBe(false);
  });
});
