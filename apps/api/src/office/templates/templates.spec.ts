import { describe, expect, it } from 'vitest';
import { numberedDesks } from '../layout/geometry';
import { validateLayout } from '../layout/validate';
import { generatedOffice } from './generated';
import { TEMPLATES } from './index';

describe.each(TEMPLATES)('template $id', (template) => {
  const layout = template.build(template.maxTeam);

  it('passes every editor check', () => {
    expect(validateLayout(layout)).toEqual([]);
  });

  it('has unique furniture ids', () => {
    const ids = layout.furniture.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has enough desks for its biggest team', () => {
    expect(numberedDesks(layout).length).toBeGreaterThanOrEqual(template.maxTeam);
  });

  it('contains exactly one board', () => {
    expect(layout.furniture.filter((f) => f.kind === 'board')).toHaveLength(1);
  });
});

describe('generated office board count and validation', () => {
  it.each([4, 8, 20, 40])('has exactly one board and validates for size %i', (size) => {
    const layout = generatedOffice(size, 'office');
    expect(layout.furniture.filter((f) => f.kind === 'board')).toHaveLength(1);
    expect(validateLayout(layout)).toEqual([]);
  });
});
