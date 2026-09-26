// Drives the real KidsLang UI like a child/parent would. Shared by the screenshot script and E2E tests.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const itemsPath = fileURLToPath(new URL('../../../content/arabic/level-1/items.json', import.meta.url));
export const items = JSON.parse(readFileSync(itemsPath, 'utf8')).items;
const byName = (name) => items.find((i) => i.name.en === name);
const byMeaning = (m) => items.find((i) => i.example.meaning === m);

export async function passGate(page) {
  const hold = page.getByRole('button', { name: /hold for 3 seconds/i });
  await hold.waitFor();
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  const q = await page.getByText(/What is \d+ × \d+\?/).textContent();
  const [, a, b] = q.match(/(\d+) × (\d+)/);
  await page.getByRole('button', { name: String(Number(a) * Number(b)), exact: true }).click();
}

async function captionTarget(page) {
  const caption = (await page.getByTestId('caption').textContent()) ?? '';
  const quoted = caption.match(/“(.+)”/);
  if (quoted) return byName(quoted[1]);
  const find = caption.match(/Find the letter (.+) in the word/);
  if (find) return byName(find[1]);
  const drag = caption.match(/that starts (.+) into the basket/);
  if (drag) return byMeaning(drag[1]);
  return null;
}

/** Traces the glyph by sweeping horizontal strokes over the same mask the scorer uses. */
export async function traceGlyph(page, { sloppy = false } = {}) {
  const canvas = page.getByTestId('trace-canvas');
  const box = await canvas.boundingBox();
  const runs = await page.evaluate(async () => {
    const GRID = 60;
    const c = document.createElement('canvas');
    c.width = GRID;
    c.height = GRID;
    const g = c.getContext('2d');
    const font = '700 37.2px "Baloo Bhaijaan 2", "Noto Naskh Arabic", serif';
    await document.fonts.load(font, 'ب');
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'rtl';
    g.fillText(document.querySelector('[data-trace-glyph]').getAttribute('data-trace-glyph'), GRID / 2, GRID / 2);
    const px = g.getImageData(0, 0, GRID, GRID).data;
    const out = [];
    for (let y = 0; y < GRID; y += 2) {
      let start = -1;
      for (let x = 0; x <= GRID; x++) {
        const on = x < GRID && px[(y * GRID + x) * 4 + 3] > 110;
        if (on && start < 0) start = x;
        if (!on && start >= 0) {
          out.push([start, x - 1, y]);
          start = -1;
        }
      }
    }
    return out;
  });
  const s = box.width / 60;
  const list = sloppy ? runs.slice(0, Math.ceil(runs.length / 4)) : runs;
  for (const [x1, x2, y] of list) {
    await page.mouse.move(box.x + x1 * s, box.y + y * s);
    await page.mouse.down();
    await page.mouse.move(box.x + (x2 + 0.5) * s, box.y + y * s, { steps: 3 });
    await page.mouse.up();
  }
}

/**
 * Solves the activity currently on screen. `wrong: true` answers incorrectly (to reach the Help Loop).
 * `before` runs just before the answer so a screenshot can show the activity.
 */
export async function solveCurrent(page, { wrong = false, before } = {}) {
  await page.waitForFunction(() =>
    document.querySelector('[data-testid="learn-card"],[data-testid="trace-canvas"],[data-testid^="option-"],[data-testid^="letter-"],[data-testid^="tile-"],[data-testid^="balloon-"],[data-testid^="seg-"]'),
  );
  await page.waitForTimeout(350);
  const has = async (sel) => (await page.locator(sel).count()) > 0;
  let kind;
  if (await has('[data-testid="learn-card"]')) kind = 'learn_card';
  else if (await has('[data-testid="trace-canvas"]')) kind = 'trace';
  else if (await has('[data-testid^="option-"]')) kind = 'listen_tap';
  else if (await has('[data-testid^="letter-"]')) kind = 'match_pairs';
  else if (await has('[data-testid^="tile-"]')) kind = 'drag_drop';
  else if (await has('[data-testid^="balloon-"]')) kind = 'pop_balloon';
  else kind = 'find_letter';

  if (kind === 'trace') {
    if (before) await before(kind);
    await traceGlyph(page, { sloppy: wrong });
    await page.getByRole('button', { name: /I'm done/ }).click();
    await page.waitForTimeout(1100);
    return kind;
  }
  if (before) await before(kind);
  const target = kind === 'learn_card' || kind === 'match_pairs' ? null : await captionTarget(page);

  switch (kind) {
    case 'learn_card':
      await page.getByTestId('learn-card').getByRole('button', { name: /Next/ }).click();
      break;
    case 'listen_tap': {
      const opts = page.locator('[data-testid^="option-"]');
      const id = wrong
        ? (await opts.evaluateAll((els, t) => els.map((e) => e.dataset.testid.slice(7)).find((x) => x !== t), target.id))
        : target.id;
      await page.getByTestId(`option-${id}`).click();
      break;
    }
    case 'match_pairs': {
      const ids = await page.locator('[data-testid^="letter-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.slice(7)));
      for (const id of ids) {
        await page.getByTestId(`letter-${id}`).click();
        await page.getByTestId(`picture-${id}`).click();
      }
      break;
    }
    case 'drag_drop': {
      const tile = await page.getByTestId(`tile-${target.id}`).boundingBox();
      const basket = await page.getByTestId('basket').boundingBox();
      await page.mouse.move(tile.x + tile.width / 2, tile.y + tile.height / 2);
      await page.mouse.down();
      await page.mouse.move(tile.x + tile.width / 2 + 10, tile.y + tile.height / 2 - 10, { steps: 3 });
      await page.mouse.move(basket.x + basket.width / 2, basket.y + basket.height / 2, { steps: 12 });
      await page.mouse.up();
      break;
    }
    case 'pop_balloon': {
      for (let i = 0; i < 6; i++) {
        const b = page.getByTestId(`balloon-${target.id}`).first();
        if ((await b.count()) === 0) break;
        await b.dispatchEvent('click');
        await page.waitForTimeout(120);
        if ((await page.getByText('🎈🎈🎈').count()) > 0) break;
      }
      break;
    }
    case 'find_letter': {
      const idx = await page.locator('[data-testid^="seg-"]').evaluateAll(
        (els, [glyph, wrongAns]) => {
          const norm = (c) => (['أ', 'إ', 'آ'].includes(c) ? 'ا' : c);
          const hit = els.findIndex((e) => (norm(e.textContent.replace(/‍/g, '')) === norm(glyph)) !== wrongAns);
          return hit;
        },
        [target.glyph, wrong],
      );
      await page.locator('[data-testid^="seg-"]').nth(Math.max(idx, 0)).click();
      break;
    }
  }
  await page.waitForTimeout(1100);
  return kind;
}

/** Plays the current lesson through to the reward screen (or the Help Loop when `failCheck`). */
export async function playLesson(page, { failCheck = false, onActivity } = {}) {
  for (let step = 0; step < 60; step++) {
    if ((await page.getByText('Hooray!').count()) > 0) return 'reward';
    if ((await page.getByRole('button', { name: /Let's practice/ }).count()) > 0) return 'help';
    const stage = await page.getByTestId('stage').getAttribute('data-stage');
    await solveCurrent(page, { wrong: failCheck && stage === 'check', before: onActivity ? (kind) => onActivity(kind, stage) : undefined });
  }
  throw new Error('lesson did not finish');
}
