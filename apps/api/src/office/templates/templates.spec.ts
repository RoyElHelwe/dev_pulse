import { describe, expect, it } from 'vitest';
import { numberedDesks } from '../layout/geometry';
import { validateLayout } from '../layout/validate';
import { TEMPLATES } from './index';

describe.each(TEMPLATES)('template $id', (template) => {
  const layout = template.build();

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
});
