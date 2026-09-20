import { test, expect } from '@playwright/test';

async function manualDecision(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Stay');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByRole('textbox', { name: 'Option 2', exact: true }).fill('Move');
  await page.getByRole('button', { name: 'Add pair', exact: true }).click();
  await page.getByRole('textbox', { name: 'Negative state 1' }).fill('Tension');
  await page.getByRole('textbox', { name: 'Positive state 1' }).fill('Calm');
}
async function setSlider(slider, value) {
  await slider.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
}

test('manual decision, importance, independent joysticks, podium, restore, and reset', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await manualDecision(page);
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  await setSlider(page.getByRole('slider', { name: 'Importance of this pair' }), 80);
  await expect(page.getByRole('slider', { name: 'Importance of this pair' })).toHaveValue('80');
  await page.getByRole('button', { name: 'Move preference for Tension', exact: true }).focus();
  await page.keyboard.press('ArrowUp');
  const ratings = await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')).pairs[0]);
  expect(ratings.controls.negative.y).toBeLessThan(0);
  expect(ratings.controls.positive.y).toBe(0);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')).pairs[0].controls.negative.y)).toBeLessThan(0);
  // Equal associations yield a predictable, tied podium.
  await page.locator('.radial-control.negative').getByRole('button', { name: 'Center', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Place 1', exact: true }).locator('h2')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Place 2', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Place 3', exact: true })).toBeVisible();
  await page.getByText('Explore the numbers', { exact: true }).click();
  await expect(page.getByRole('table')).toContainText('50.00%');
  await expect(page.getByRole('table')).toContainText('—');
  await page.getByRole('button', { name: 'Revisit your ratings' }).click();
  await expect(page.getByRole('slider', { name: 'Importance of this pair' })).toHaveValue('80');
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('button', { name: 'Keep my decision' }).click();
  await expect(page.getByRole('button', { name: 'Move preference for Tension', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start over', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('table columns and podium stay between zero and one hundred after a nonuniform assessment', async ({ page }) => {
  await manualDecision(page);
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  await page.getByRole('button', { name: 'Move preference for Tension', exact: true }).focus();
  await page.keyboard.press('ArrowUp');
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Place 1', exact: true }).locator('.score')).toHaveText('100%');
  await expect(page.getByRole('region', { name: 'Place 2', exact: true }).locator('.score')).toHaveText('0%');
  await expect(page.locator('.flame')).toHaveCount(0);
  await page.getByText('Explore the numbers', { exact: true }).click();
  const values = await page.getByRole('table').locator('td').allTextContents();
  for (const value of values.filter(value => value !== '—')) {
    expect(parseFloat(value)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(value)).toBeLessThanOrEqual(100);
  }
  await expect(page.getByRole('table')).toContainText('100.00%');
  await expect(page.getByRole('table')).toContainText('0.00%');
});

test('demo suggestions in user language require acceptance and preserve edits', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('Я хочу переехать в другой город и сравнить варианты.');
  await page.getByRole('button', { name: 'Explore with AI' }).click();
  await expect(page.getByRole('region', { name: 'Suggestions', exact: true })).toContainText('Душевное напряжение');
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add all options', exact: true }).click();
  await page.getByRole('button', { name: 'Add all pairs', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveValue('Остаться на месте');
  await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('My own option');
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  await setSlider(page.getByRole('slider', { name: 'Importance of this pair' }), 15);
  await page.getByRole('button', { name: 'Edit options & pairs' }).click();
  await page.getByRole('button', { name: 'Suggest more', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Suggestions', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveValue('My own option');
  await expect(page.getByRole('slider')).toHaveCount(0);
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  await page.getByRole('button', { name: 'Next pair' }).click();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Importance of this pair' })).toHaveValue('15');
});

test('AI failure is quiet and manual controls remain available', async ({ page }) => {
  await page.route('**/api/suggest', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('I need to compare a few possibilities.');
  await page.getByRole('button', { name: 'Explore with AI' }).click();
  await expect(page.getByRole('button', { name: 'Explore with AI' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Add option', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Add pair', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText(/error|failed/i)).toHaveCount(0);
});

test('pending AI request cannot revive a reset decision', async ({ page }) => {
  let respond;
  await page.route('**/api/suggest', async route => {
    await new Promise(resolve => { respond = resolve; });
    await route.fulfill({ json: { message: 'Old suggestion', options: ['Old option'], pairs: [] } }).catch(() => {});
  });
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('An old decision I will discard.');
  await page.getByRole('button', { name: 'Explore with AI' }).click();
  await expect.poll(() => Boolean(respond)).toBeTruthy();
  await page.getByRole('button', { name: 'Start over', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Start over', exact: true }).click();
  respond();
  await expect(page.getByRole('textbox', { name: 'Describe your decision' })).toHaveValue('');
  await expect(page.getByText('Old suggestion')).toHaveCount(0);
});

test('mobile layout fits and importance/joysticks support keyboard input', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await manualDecision(page);
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  await page.getByRole('slider', { name: 'Importance of this pair' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('slider', { name: 'Importance of this pair' })).toHaveValue('51');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Move preference for Calm', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Calculate', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/mobile-results.png', fullPage: true });
});

test('explicit alternatives appear immediately without AI and deleted options stay deleted', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('Выбираю между Москвой, Таллином и Лондоном.');
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveValue('Москвой');
  await expect(page.getByRole('textbox', { name: 'Option 3', exact: true })).toHaveValue('Лондоном');
  await page.getByRole('button', { name: 'Remove option 2', exact: true }).click();
  await page.getByRole('textbox', { name: 'Describe your decision' }).focus();
  await page.getByRole('textbox', { name: 'Describe your decision' }).blur();
  await expect(page.getByRole('textbox', { name: 'Option 3', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Option 2', exact: true })).toHaveValue('Лондоном');
});

test('automatic extraction does not swallow the click on Add pair when leaving the description', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('I am choosing between London, Tallinn and Riga.');
  await page.getByRole('button', { name: 'Add pair', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Negative state 1', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Option 3', exact: true })).toHaveValue('Riga');
});

test('AI-mentioned alternatives are added directly while invented ideas remain suggestions', async ({ page }) => {
  await page.route('**/api/suggest', route => route.fulfill({ json: {
    message: 'Here are your possibilities.',
    mentionedOptions: [{ label: 'London', evidence: 'London' }, { label: 'Riga', evidence: 'Riga' }, { label: 'Invented', evidence: 'not in the description' }],
    options: ['Tallinn'], pairs: [],
  } }));
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Describe your decision' }).fill('London appeals to me. Riga feels familiar. I am torn.');
  await page.getByRole('button', { name: 'Explore with AI' }).click();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveValue('London');
  await expect(page.getByRole('textbox', { name: 'Option 2', exact: true })).toHaveValue('Riga');
  await expect(page.getByRole('textbox', { name: 'Option 3', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Suggestions', exact: true })).toContainText('Tallinn');
  await page.getByRole('textbox', { name: 'Option 1', exact: true }).fill('Berlin');
  await page.getByRole('button', { name: 'Explore with AI' }).click();
  await expect(page.getByRole('textbox', { name: 'Option 1', exact: true })).toHaveValue('Berlin');
  await expect(page.getByRole('textbox', { name: 'Option 3', exact: true })).toHaveCount(0);
});

test('dragging joysticks and ring labels changes distances and persists independent layouts', async ({ page }) => {
  await manualDecision(page);
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  const puck = page.getByRole('button', { name: 'Move preference for Tension', exact: true });
  await puck.scrollIntoViewIfNeeded();
  const box = await puck.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 - 40, { steps: 8 }); await page.mouse.up();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')));
  expect(saved.pairs[0].controls.negative.x).toBeGreaterThan(0);
  expect(saved.pairs[0].controls.negative.y).toBeLessThan(0);
  expect(saved.pairs[0].controls.positive.x).toBe(0);
  const label = page.getByRole('button', { name: 'Reposition Stay for Tension', exact: true });
  const node = await label.boundingBox();
  const stage = await page.locator('.radial-control.negative .radial-stage').boundingBox();
  await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2);
  await page.mouse.down(); await page.mouse.move(stage.x + stage.width * .82, stage.y + stage.height * .5, { steps: 10 }); await page.mouse.up();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')));
  const angles = saved.pairs[0].controls.negative.angles;
  expect(angles[saved.options[0].id]).toBeCloseTo(0);
  expect(saved.pairs[0].controls.positive.angles[saved.options[0].id]).toBeCloseTo(-Math.PI / 2);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')).pairs[0].controls.negative.angles)).toEqual(angles);
});

test('six options fit on mobile and touch can move the positive joystick', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await manualDecision(page);
  for (let index = 3; index <= 6; index++) {
    await page.getByRole('button', { name: 'Add option', exact: true }).click();
    await page.getByRole('textbox', { name: `Option ${index}`, exact: true }).fill(`Alternative ${index}`);
  }
  await page.getByRole('button', { name: 'Weigh my options' }).click();
  const puck = page.getByRole('button', { name: 'Move preference for Calm', exact: true });
  await puck.scrollIntoViewIfNeeded();
  const box = await puck.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 30, y: y - 20 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('decision-matrix:v1')).pairs[0].controls.positive.x)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/mobile-joystick.png' });
});
