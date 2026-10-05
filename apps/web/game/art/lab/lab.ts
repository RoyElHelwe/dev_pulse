import type { OfficeLayout } from '../../layout/types';
import { seededRandom } from '../../render/draw';
import { type Direction, drawCharacter, type Mood } from '../character';
import { css } from '../color';
import { drawDesk } from '../desk';
import { BOTTOM, CLOTH, HAIR, SHOES, SKIN, type Swatch } from '../palette';
import { canvasPen } from '../pen';
import { breed, decode, encode, FIELDS, HAT_FREE_HAIR, mutate, PRESETS, randomRecipe, type Recipe, tidy } from '../recipe';
import { OfficeSim, skyAt } from './office';

// The art lab page: a live office, a character studio, a lineup to test
// variety ("10,000 bowls of oatmeal") and the palette. Built from the same
// modules the game uses. See lab.html for the markup.

export interface LabTemplate {
  id: string;
  name: string;
  layout: OfficeLayout;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const NAMES = [
  'Roy', 'Mira', 'Zakaria', 'Ines', 'Theo', 'Priya', 'Kofi', 'Lena', 'Mateo', 'Sana', 'Felix', 'Yuki', 'Ada', 'Nils',
  'Rosa', 'Idris', 'June', 'Arlo', 'Noor', 'Ezra', 'Tariq', 'Wren', 'Luca', 'Esme', 'Kian', 'Amara', 'Bram', 'Cleo',
  'Dario', 'Elif', 'Femi', 'Greta', 'Hugo', 'Isla', 'Jonah', 'Kaia', 'Leon', 'Maren', 'Nadia', 'Otto', 'Pia', 'Quinn',
  'Rami', 'Suki', 'Tomas', 'Uma', 'Vera', 'Wes',
];

/** Paints a character into a canvas cell, scaled, feet at (x, y). */
function paint(ctx: CanvasRenderingContext2D, recipe: Recipe, x: number, y: number, scale: number, pose: Parameters<typeof drawCharacter>[2]) {
  const pen = canvasPen(ctx);
  pen.push(x, y, 0, scale, scale);
  drawCharacter(pen, recipe, pose);
  pen.pop();
}

/** Sizes a canvas to its CSS box at the device pixel ratio; returns the CSS size. */
function fit(canvas: HTMLCanvasElement, height?: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = height ?? canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  if (height !== undefined) canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

export function mountLab(templates: LabTemplate[]) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let recipe: Recipe = PRESETS.lea;
  const pose = { mood: 'neutral' as Mood, headset: false, talking: false, mug: false, walk: true };
  let wear = 0.4;

  // ---------------------------------------------------------------- office
  const random = seededRandom('lab-people');
  const people = Array.from({ length: 80 }, (_, i) => ({
    name: i === 0 ? 'You' : NAMES[(i - 1) % NAMES.length] + (i > NAMES.length ? ` ${String.fromCharCode(65 + Math.floor(i / NAMES.length))}.` : ''),
    recipe: i === 0 ? recipe : randomRecipe(random),
  }));
  const officeCanvas = $<HTMLCanvasElement>('office');
  let sim: OfficeSim;
  const build = (id: string) => {
    const t = templates.find((x) => x.id === id) ?? templates[0];
    const hour = sim?.hour ?? 10.5;
    sim = new OfficeSim(officeCanvas, t.layout, people, { onPick: (p) => load(p.recipe, `${p.name}'s character`) });
    sim.setHour(hour);
    sim.showRadius = $<HTMLInputElement>('radius').checked;
  };
  const templateSelect = $<HTMLSelectElement>('template');
  templateSelect.innerHTML = templates.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
  templateSelect.addEventListener('change', () => build(templateSelect.value));
  build(templates[0].id);

  let playing = !reduced;
  let speed = 0.25;
  const playButton = $<HTMLButtonElement>('play');
  const syncPlay = () => {
    playButton.textContent = playing ? 'Pause' : 'Play';
    playButton.setAttribute('aria-pressed', String(playing));
  };
  syncPlay();
  playButton.addEventListener('click', () => {
    playing = !playing;
    syncPlay();
  });
  $<HTMLSelectElement>('speed').addEventListener('change', (e) => (speed = Number((e.target as HTMLSelectElement).value)));
  const hourInput = $<HTMLInputElement>('hour');
  let scrubbing = false;
  hourInput.addEventListener('input', () => {
    scrubbing = true;
    sim.setHour(Number(hourInput.value));
  });
  hourInput.addEventListener('change', () => (scrubbing = false));
  $<HTMLInputElement>('radius').addEventListener('change', (e) => (sim.showRadius = (e.target as HTMLInputElement).checked));
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-hour]')) {
    b.addEventListener('click', () => sim.setHour(Number(b.dataset.hour)));
  }

  const clock = $('clock');
  const phaseLabel = $('phase');
  const skyChip = $('sky');
  const updateClock = () => {
    const h = sim.hour;
    const hh = Math.floor(h);
    const mm = Math.floor((h - hh) * 60);
    clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    phaseLabel.textContent = h < 6 ? 'Night' : h < 9 ? 'Morning' : h < 12.5 ? 'Late morning' : h < 17 ? 'Afternoon' : h < 20 ? 'Evening' : 'Night';
    skyChip.style.background = css(skyAt(h));
    if (!scrubbing) hourInput.value = String(h);
  };

  // ---------------------------------------------------------------- studio
  const partsEl = $('parts');
  const groups: { title: string; keys: (keyof Recipe)[] }[] = [
    { title: 'Body', keys: ['build', 'height', 'skin', 'freckles'] },
    { title: 'Hair and face', keys: ['hair', 'hairColor', 'beard', 'glasses'] },
    { title: 'Outfit', keys: ['top', 'topColor', 'pattern', 'trimColor', 'bottom', 'bottomColor', 'shoes'] },
    { title: 'Extras', keys: ['hat', 'hatColor', 'vibe'] },
  ];
  const LABELS: Partial<Record<keyof Recipe, string>> = {
    hairColor: 'hair colour', topColor: 'top colour', trimColor: 'second colour', bottomColor: 'bottom colour', hatColor: 'hat colour', vibe: 'desk vibe',
  };
  const SWATCHES: Partial<Record<keyof Recipe, Swatch[]>> = {
    skin: SKIN, hairColor: HAIR, topColor: CLOTH, trimColor: CLOTH, hatColor: CLOTH, bottomColor: BOTTOM, shoes: SHOES,
  };
  const valueOf = (key: keyof Recipe) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const v = recipe[key];
    return field.options ? field.options.indexOf(v as string) : typeof v === 'boolean' ? Number(v) : (v as number);
  };
  const setField = (key: keyof Recipe, index: number) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const value = field.options ? field.options[index] : key === 'freckles' ? index === 1 : index;
    recipe = tidy({ ...recipe, [key]: value } as Recipe);
    changed();
  };
  const renderParts = () => {
    partsEl.innerHTML = groups
      .map(
        (g) => `<fieldset class="group"><legend>${g.title}</legend>${g.keys
          .map((key) => {
            const field = FIELDS.find((f) => f.key === key)!;
            const swatches = SWATCHES[key];
            const current = valueOf(key);
            const chips = Array.from({ length: field.size }, (_, i) => {
              const label = swatches ? swatches[i].name : field.options ? field.options[i] : key === 'height' ? ['short', 'average', 'tall'][i] : ['no', 'yes'][i];
              const off = key === 'hat' && i > 0 && HAT_FREE_HAIR.includes(recipe.hair);
              const on = i === current;
              return swatches
                ? `<button type="button" class="swatch${on ? ' on' : ''}" data-key="${key}" data-i="${i}" title="${label}" aria-label="${LABELS[key] ?? key}: ${label}" aria-pressed="${on}" style="--c:${css(swatches[i].ramp.base)};--d:${css(swatches[i].ramp.shadow)}"></button>`
                : `<button type="button" class="chip${on ? ' on' : ''}" data-key="${key}" data-i="${i}" aria-pressed="${on}"${off ? ` disabled title="Not with ${recipe.hair} hair"` : ''}>${label}</button>`;
            }).join('');
            return `<div class="field"><span class="field-name">${LABELS[key] ?? key}</span><div class="options">${chips}</div></div>`;
          })
          .join('')}</fieldset>`,
      )
      .join('');
  };
  partsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (b && !b.disabled) setField(b.dataset.key as keyof Recipe, Number(b.dataset.i));
  });

  const dnaEl = $('dna');
  const sourceEl = $('source');
  const changed = (source = 'Edited in the studio') => {
    renderParts();
    dnaEl.textContent = encode(recipe);
    sourceEl.textContent = source;
    sim.setRecipe(0, recipe);
    people[0].recipe = recipe;
  };
  const load = (r: Recipe, source: string) => {
    recipe = r;
    changed(source);
    document.getElementById('studio')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  const studioRandom = seededRandom(`studio-${Date.now()}`);
  $('randomize').addEventListener('click', () => {
    recipe = randomRecipe(studioRandom);
    changed('Random, with the harmony rules');
  });
  $('mutate').addEventListener('click', () => {
    recipe = mutate(recipe, studioRandom);
    changed('One to three parts re-rolled');
  });
  $('copy').addEventListener('click', () => {
    const code = encode(recipe);
    const note = $('copy-note');
    navigator.clipboard
      ?.writeText(code)
      .then(() => (note.textContent = 'Copied'))
      .catch(() => {
        const range = document.createRange();
        range.selectNodeContents(dnaEl);
        getSelection()?.removeAllRanges();
        getSelection()?.addRange(range);
        note.textContent = 'Selected: press Ctrl+C';
      });
    setTimeout(() => (note.textContent = ''), 2200);
  });
  const pasteInput = $<HTMLInputElement>('paste');
  pasteInput.addEventListener('input', () => {
    const code = pasteInput.value.trim();
    const r = PRESETS[code] ?? decode(code);
    $('paste-note').textContent = !code ? '' : r ? 'Loaded' : 'Not a character code yet: codes start with 1 and have 19 characters.';
    if (r) {
      recipe = r;
      changed('Loaded from a code');
    }
  });
  const moodSelect = $<HTMLSelectElement>('mood');
  moodSelect.addEventListener('change', () => (pose.mood = moodSelect.value as Mood));
  for (const key of ['headset', 'talking', 'mug', 'walk'] as const) {
    const box = $<HTMLInputElement>(`t-${key}`);
    box.checked = pose[key];
    box.addEventListener('change', () => (pose[key] = box.checked));
  }
  const wearInput = $<HTMLInputElement>('wear');
  wearInput.addEventListener('input', () => (wear = Number(wearInput.value)));

  const turntable = $<HTMLCanvasElement>('turntable');
  const dirsCanvas = $<HTMLCanvasElement>('dirs');
  const deskCanvas = $<HTMLCanvasElement>('desk');
  const DIRS: Direction[] = ['down', 'right', 'up', 'left'];
  const drawStudio = (t: number) => {
    {
      const { ctx, w, h } = fit(turntable);
      const scale = Math.min(4.2, h / 70);
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h - 30, 70, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      const dir = pose.walk ? DIRS[Math.floor(t / 2200) % 4] : 'down';
      paint(ctx, recipe, w / 2, h - 30, scale, {
        dir, moving: pose.walk, phase: t * 0.012, time: t, mood: pose.mood, headset: pose.headset || pose.talking, talking: pose.talking, mug: pose.mug, shadow: true,
      });
    }
    {
      const { ctx, w, h } = fit(dirsCanvas);
      DIRS.forEach((dir, i) => paint(ctx, recipe, (w / 4) * (i + 0.5), h - 8, 1.25, { dir, shadow: true, mood: pose.mood, headset: pose.headset || pose.talking }));
    }
    {
      const { ctx, w, h } = fit(deskCanvas);
      const scale = Math.min(2.6, (w - 20) / 100);
      const pen = canvasPen(ctx);
      ctx.fillStyle = '#dcc29e';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(185,154,114,0.35)';
      for (let y = 12 * scale; y < h; y += 12 * scale) ctx.fillRect(0, y, w, 1);
      pen.push(w / 2, h * 0.36, 0, scale, scale);
      drawDesk(pen, 96, 48, { seed: `studio-${recipe.vibe}`, owner: recipe, wear, headsetOn: pose.headset || pose.talking, time: t });
      pen.pop();
      paint(ctx, recipe, w / 2, h * 0.36 + 66 * scale * 0.95, scale, { dir: 'up', shadow: true, headset: pose.headset || pose.talking, time: t });
    }
  };

  // ---------------------------------------------------------------- lineup
  const lineupCanvas = $<HTMLCanvasElement>('lineup');
  const lineupNote = $('lineup-note');
  const lineupRandom = seededRandom(`lineup-${Date.now()}`);
  let lineup: Recipe[] = [];
  let breeding = false;
  let hoverCell = -1;
  const CELL_W = 74;
  const CELL_H = 92;
  const layoutGrid = () => {
    const cols = Math.max(4, Math.floor(lineupCanvas.clientWidth / CELL_W));
    return { cols, rows: 4, count: cols * 4 };
  };
  const shuffle = () => {
    lineup = Array.from({ length: layoutGrid().count }, () => randomRecipe(lineupRandom));
    lineupNote.textContent = 'Random characters. Click one to open it in the studio.';
  };
  const variations = () => {
    lineup = Array.from({ length: layoutGrid().count }, (_, i) => (i === 0 ? recipe : mutate(recipe, lineupRandom)));
    lineupNote.textContent = 'Variations of the studio character (first cell). Click one to keep it, then make variations again.';
  };
  shuffle();
  $('shuffle').addEventListener('click', () => {
    breeding = false;
    shuffle();
  });
  $('variations').addEventListener('click', () => {
    breeding = false;
    variations();
  });
  $('breed').addEventListener('click', () => {
    breeding = true;
    lineupNote.textContent = 'Pick a partner for the studio character: click anyone in the lineup.';
  });
  const cellAt = (e: PointerEvent | MouseEvent) => {
    const rect = lineupCanvas.getBoundingClientRect();
    const { cols } = layoutGrid();
    const cw = rect.width / cols;
    const c = Math.floor((e.clientX - rect.left) / cw);
    const r = Math.floor((e.clientY - rect.top) / CELL_H);
    const i = r * cols + c;
    return i >= 0 && i < lineup.length ? i : -1;
  };
  lineupCanvas.addEventListener('pointermove', (e) => (hoverCell = cellAt(e)));
  lineupCanvas.addEventListener('pointerleave', () => (hoverCell = -1));
  lineupCanvas.addEventListener('click', (e) => {
    const i = cellAt(e);
    if (i < 0) return;
    if (breeding) {
      const partner = lineup[i];
      lineup = Array.from({ length: layoutGrid().count }, (_, k) => (k === 0 ? recipe : k === 1 ? partner : breed(recipe, partner, lineupRandom)));
      breeding = false;
      lineupNote.textContent = 'Children of the studio character (first) and the partner (second). Each part comes from one of them, with the odd mutation.';
      return;
    }
    load(lineup[i], 'Picked from the lineup');
  });
  const drawLineup = (t: number) => {
    const { cols, rows } = layoutGrid();
    const { ctx, w } = fit(lineupCanvas, rows * CELL_H);
    const cw = w / cols;
    const ink = token('--line');
    for (let i = 0; i < lineup.length; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      if (i === hoverCell) {
        ctx.fillStyle = token('--hover');
        ctx.beginPath();
        ctx.roundRect(c * cw + 3, r * CELL_H + 3, cw - 6, CELL_H - 6, 10);
        ctx.fill();
      }
      paint(ctx, lineup[i], c * cw + cw / 2, r * CELL_H + CELL_H - 10, 1.25, {
        dir: 'down', time: reduced ? undefined : t + i * 613, shadow: true, mood: i === hoverCell ? 'happy' : 'neutral',
      });
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let r = 1; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_H + 0.5);
      ctx.lineTo(w, r * CELL_H + 0.5);
      ctx.stroke();
    }
  };

  // ---------------------------------------------------------------- palette
  const rampsEl = $('ramps');
  const sets: [string, Swatch[]][] = [['Skin', SKIN], ['Hair', HAIR], ['Clothes', CLOTH], ['Bottoms', BOTTOM], ['Shoes', SHOES]];
  rampsEl.innerHTML = sets
    .map(
      ([title, list]) => `<div class="ramp-row"><span class="ramp-title">${title}</span><div class="ramp-list">${list
        .map((s) => {
          const tones = [s.ramp.glint, s.ramp.light, s.ramp.base, s.ramp.shadow, s.ramp.deep];
          return `<div class="ramp" title="${s.name}">${tones.map((c) => `<span style="background:${css(c)}"></span>`).join('')}</div>`;
        })
        .join('')}</div></div>`,
    )
    .join('');
  const compareCanvas = $<HTMLCanvasElement>('compare');
  const cmpRandom = seededRandom('compare-7');
  const compareCast = [PRESETS.zoe, PRESETS.omar, ...Array.from({ length: 4 }, () => randomRecipe(cmpRandom))];
  const drawCompare = () => {
    const { ctx, w, h } = fit(compareCanvas);
    const n = Math.max(3, Math.min(compareCast.length, Math.floor(w / 70)));
    const scale = Math.min(2.4, w / n / 34);
    ctx.fillStyle = '#e9e4dc';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#dcc29e';
    ctx.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < n; i++) {
      const x = (w / n) * (i + 0.5);
      paint(ctx, compareCast[i], x, h / 2 - 12, scale, { dir: i % 2 ? 'right' : 'down', flat: true, shadow: true });
      paint(ctx, compareCast[i], x, h - 12, scale, { dir: i % 2 ? 'right' : 'down', shadow: true });
    }
  };
  const combos = FIELDS.reduce((p, f) => p * BigInt(f.size), 1n);
  $('combos').textContent = `${(Number(combos) / 1e12).toFixed(1)} trillion`;
  $('fields').textContent = String(FIELDS.length);

  // ---------------------------------------------------------------- loop
  changed('Lea, one of the 8 original characters');
  let last = performance.now();
  let compareDrawn = 0;
  const frame = (now: number) => {
    const dt = Math.min(64, now - last);
    last = now;
    sim.tick(dt, playing ? speed : 0);
    sim.render(officeCanvas.clientWidth);
    updateClock();
    drawStudio(now);
    drawLineup(now);
    if (compareDrawn !== compareCanvas.clientWidth) {
      compareDrawn = compareCanvas.clientWidth;
      drawCompare();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
