// Golden snapshots: freeze exact template and wing-chain output so refactors of templates/ and wings.ts provably keep layouts identical.
// Update snapshots only on an intentional layout change.
import { describe, expect, it } from 'vitest';
import { campus } from '../templates/campus';
import { generatedOffice } from '../templates/generated';
import { hq } from '../templates/hq';
import { findTemplate, TEMPLATES } from '../templates/index';
import { loft } from '../templates/loft';
import { studio } from '../templates/studio';
import type { OfficeLayout } from './types';
import { addWing, type AddWingOptions, WingError, type WingSide } from './wings';

function runWingChain(
  initialLayout: OfficeLayout,
  chain: WingSide[],
  seed: string,
  options?: AddWingOptions,
) {
  let layout = initialLayout;
  for (let i = 0; i < chain.length; i++) {
    const side = chain[i];
    const index = i + 1;
    try {
      const result = addWing(layout, side, seed, index, options);
      expect(result).toMatchSnapshot();
      layout = result.layout;
    } catch (err) {
      if (err instanceof WingError) {
        expect({ error: err.code, message: err.message }).toMatchSnapshot();
        break;
      }
      throw err;
    }
  }
}

describe('office layout golden snapshots', () => {
  describe('templates', () => {
    describe('TEMPLATES default build()', () => {
      for (const template of TEMPLATES) {
        it(`template ${template.id}`, () => {
          expect(template.build()).toMatchSnapshot();
        });
      }
    });

    describe('generated teamSize and seed variations', () => {
      const generated = findTemplate('generated')!;
      const teamSizes = [1, 5, 12, 40, 100];
      const seeds = ['office', 'zeta'];
      for (const seed of seeds) {
        for (const teamSize of teamSizes) {
          it(`generated teamSize ${teamSize} seed ${seed}`, () => {
            expect(generated.build(teamSize, seed)).toMatchSnapshot();
          });
        }
      }
    });
  });

  describe('wing chains', () => {
    describe('starting from loft() with seed alpha', () => {
      it('chain [LEFT, LEFT, BOTTOM]', () => {
        runWingChain(loft(), ['LEFT', 'LEFT', 'BOTTOM'], 'alpha');
      });

      it('chain [RIGHT, BOTTOM, LEFT, RIGHT]', () => {
        runWingChain(loft(), ['RIGHT', 'BOTTOM', 'LEFT', 'RIGHT'], 'alpha');
      });

      it('chain [BOTTOM, BOTTOM, RIGHT]', () => {
        runWingChain(loft(), ['BOTTOM', 'BOTTOM', 'RIGHT'], 'alpha');
      });
    });

    describe('starting from studio() with seed beta', () => {
      it('chain [LEFT, RIGHT, BOTTOM]', () => {
        runWingChain(studio(), ['LEFT', 'RIGHT', 'BOTTOM'], 'beta');
      });
    });

    describe('starting from generatedOffice(12, "office") with seed gamma', () => {
      it('chain [BOTTOM, LEFT, RIGHT]', () => {
        runWingChain(generatedOffice(12, 'office'), ['BOTTOM', 'LEFT', 'RIGHT'], 'gamma');
      });
    });

    describe('starting from hq() with seed delta', () => {
      it('chain [RIGHT, BOTTOM]', () => {
        runWingChain(hq(), ['RIGHT', 'BOTTOM'], 'delta');
      });
    });

    describe('chill wings starting from campus() with seed pulse', () => {
      const sides: WingSide[] = ['LEFT', 'RIGHT', 'BOTTOM'];
      for (const side of sides) {
        it(`chill wing on ${side}`, () => {
          runWingChain(campus(), [side], 'pulse', { special: 'chill' });
        });
      }
    });
  });
});
