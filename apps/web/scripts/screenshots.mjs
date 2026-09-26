// Walks through every KidsLang screen on a phone viewport and saves screenshots to docs/screens.
// Usage: npm run build && npx vite preview --port 4173 & npm run screenshots
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { passGate, playLesson, solveCurrent } from './kidslang-driver.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = fileURLToPath(new URL('../../../docs/screens/', import.meta.url));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'en-US',
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const shot = async (name) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('📸', name);
};

// 1. Welcome
await page.goto(BASE);
await page.evaluate(() => document.fonts.ready);
await shot('01-welcome');

// 2. Parent sign-up with consent
await page.getByRole('button', { name: /Let's go/ }).click();
await page.getByLabel('Email').fill('parent@example.com');
await page.getByLabel('Password').fill('kidslang-demo');
await page.getByRole('checkbox').check();
await shot('02-parent-signup');
await page.getByRole('button', { name: 'Create account' }).click();

// Parent gate (hold, then multiplication)
await page.getByRole('button', { name: /hold for 3 seconds/i }).waitFor();
await shot('03-parent-gate-hold');
{
  const hold = page.getByRole('button', { name: /hold for 3 seconds/i });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(3300);
  await page.mouse.up();
  await shot('04-parent-gate-question');
  const q = await page.getByText(/What is \d+ × \d+\?/).textContent();
  const [, a, b] = q.match(/(\d+) × (\d+)/);
  await page.getByRole('button', { name: String(Number(a) * Number(b)), exact: true }).click();
}

// New child profile with picture PIN
await page.getByLabel('Nickname').fill('Sara');
await page.getByRole('button', { name: '🦊' }).click();
await page.getByRole('button', { name: '🌟' }).click();
await page.getByRole('button', { name: '🐶' }).click();
await page.getByRole('button', { name: '🌈' }).click();
await shot('05-new-child-profile');
await page.getByRole('button', { name: 'Create profile' }).click();

// Second child (gate still valid for 5 minutes)
await page.getByRole('button', { name: /Add a child/ }).click();
await page.getByLabel('Nickname').fill('Omar');
await page.getByRole('button', { name: '7–10 years' }).click();
await page.getByRole('button', { name: '🐯' }).click();
await page.getByRole('button', { name: 'Create profile' }).click();

// 3. Who's learning?
await page.getByText("Who's learning?").waitFor();
await shot('06-whos-learning');

// Picture PIN entry
await page.getByTestId('child-Sara').click();
await page.getByText('Tap your 3 secret pictures').waitFor();
await page.getByRole('button', { name: '🌟' }).click();
await shot('07-picture-pin');
await page.getByRole('button', { name: '🐶' }).click();
await page.getByRole('button', { name: '🌈' }).click();

// 4. Course picker
await page.getByTestId('course-ar').waitFor();
await shot('08-course-picker');
await page.getByTestId('course-ar').click();

// 5. Journey map (fresh)
await page.getByTestId('journey').waitFor();
await shot('09-journey-start');

// 6–7. Lesson runner + every activity type (lesson 1: Alif)
await page.getByTestId('node-ar-l1-u1-l1').click();
const seen = new Set();
const names = { learn_card: '10-learn-card', trace: '11-trace-letter', listen_tap: '12-listen-tap', match_pairs: '13-match-pairs', drag_drop: '14-drag-drop', pop_balloon: '15-pop-balloon', find_letter: '16-find-letter' };
await playLesson(page, {
  onActivity: async (kind, stage) => {
    const key = stage === 'check' ? `check-${kind}` : kind;
    if (seen.has(key)) return;
    seen.add(key);
    if (stage === 'check' && kind === 'listen_tap') await shot('17-check-quiz');
    else if (stage !== 'check' && names[kind]) await shot(names[kind]);
  },
});

// 8. Reward
await shot('18-reward');
await page.getByRole('button', { name: /^Next/ }).click();

// 9. Help Loop: answer the lesson 2 (Ba) quiz incorrectly
const outcome = await playLesson(page, { failCheck: true });
if (outcome !== 'help') throw new Error('expected the Help Loop');
await shot('19-help-loop');
await page.getByRole('button', { name: /Let's practice/ }).click();
await solveCurrent(page); // re-teach card
await shot('20-help-loop-practice');
await playLesson(page);
await page.getByRole('button', { name: /^Next/ }).click();

// Finish unit 1 (Ta, Tha) and its checkpoint to earn a sticker
await playLesson(page);
await page.getByRole('button', { name: /^Next/ }).click();
await playLesson(page);
await page.getByRole('button', { name: /^Next/ }).click();
await playLesson(page);
await shot('21-reward-checkpoint-sticker');
await page.getByRole('button', { name: /Back to map/ }).click();
await page.getByTestId('journey').waitFor();
await page.getByTestId('node-ar-l1-u2-l1').scrollIntoViewIfNeeded();
await page.evaluate(() => document.querySelector('[data-testid="journey"]').scrollBy(0, -260));
await shot('22-journey-progress');

// 10. Practice Garden — jump the clock 2 days so learned letters are due
await page.clock.install({ time: new Date(Date.now() + 2 * 86_400_000 + 3_600_000) });
await page.goto(`${BASE}/garden`);
await page.getByText('Practice Garden').waitFor();
if (process.env.DEBUG) console.log(JSON.stringify(await page.evaluate(() => ({ now: new Date().toISOString(), items: Object.values(JSON.parse(localStorage.getItem('kidslang')).state.data)[0].items }))));
await shot('23-practice-garden');
await page.getByRole('button', { name: /Water my garden/ }).click();
await page.locator('[data-testid^="option-"]').first().waitFor();
await shot('24-garden-review');
for (let i = 0; i < 12; i++) {
  if ((await page.locator('[data-testid^="option-"]').count()) === 0) break;
  // pick the first option: good enough for a walkthrough; wrong answers feed "weak letters"
  await page.locator('[data-testid^="option-"]').first().click();
  await page.waitForTimeout(1000);
  if ((await page.locator('[data-testid^="option-"]').count()) > 0 && (await page.getByText('Try again!').count()) > 0) {
    const opts = page.locator('[data-testid^="option-"]');
    for (let k = 1; k < (await opts.count()); k++) {
      if ((await page.getByText('Great job!').count()) > 0) break;
      await opts.nth(k).click();
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(900);
  }
}
await page.getByText('Your garden grew!').waitFor();
await shot('25-garden-watered');

// 11. Sticker book & avatar
await page.getByRole('link', { name: /Stickers/ }).click();
await shot('26-sticker-book');
await page.getByRole('button', { name: /My look/ }).click();
await page.getByRole('button', { name: '🧢' }).click();
await shot('27-avatar');

// 12. Parent dashboard (behind the gate)
await page.goto(`${BASE}/profiles`);
await page.getByRole('button', { name: 'Grown-ups' }).click();
await passGate(page);
await page.getByText('Parent dashboard').waitFor();
await shot('28-parent-dashboard');
await page.getByText('Settings', { exact: false }).first().scrollIntoViewIfNeeded();
await shot('29-parent-settings');

// Arabic UI (RTL) — switch instruction language and view the journey
await page.getByRole('combobox').nth(1).selectOption('ar');
await page.goto(`${BASE}/journey/ar`);
await page.getByTestId('journey').waitFor();
await shot('30-journey-arabic-ui');

// Screen-time limit reached → friendly break screen
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('kidslang'));
  const id = s.state.activeChildId;
  const d = new Date();
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.state.settings[id].uiLang = 'en';
  s.state.data[id].minutesByDay[key] = 99;
  localStorage.setItem('kidslang', JSON.stringify(s));
});
await page.goto(`${BASE}/journey/ar`);
await page.getByText('time for a break').waitFor();
await shot('31-break-time');

// Desktop: centred phone frame
await page.setViewportSize({ width: 1280, height: 900 });
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('kidslang'));
  s.state.data[s.state.activeChildId].minutesByDay = {};
  localStorage.setItem('kidslang', JSON.stringify(s));
});
await page.goto(`${BASE}/journey/ar`);
await page.getByTestId('journey').waitFor();
await shot('32-desktop-phone-frame');

await browser.close();
const real = errors.filter((e) => !/fonts\.g|Failed to load resource/.test(e));
if (real.length) {
  console.error('Console errors:\n' + real.join('\n'));
  process.exit(1);
}
console.log('✅ all screens captured without console errors');
