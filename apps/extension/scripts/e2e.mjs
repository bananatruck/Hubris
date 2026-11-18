import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { demoData } from './fixtures/demo-data.mjs';

const require = createRequire(import.meta.url);
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const screenshots = fileURLToPath(new URL('../../../docs/screenshots/', import.meta.url));
const runtimeErrors = [];
const seenMessages = new WeakSet();
let failed = false;
let context;
let profile;
let popup;
let panel;

function captureConsole(message) {
  if (message.type() !== 'error' || seenMessages.has(message)) return;
  seenMessages.add(message);
  runtimeErrors.push(`console: ${message.text()}`);
}

async function step(number, name, action) {
  try {
    await action();
    console.log(`PASS Step ${number}: ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL Step ${number}: ${name}: ${error.message}`);
  }
}

async function selectTab(page, name) {
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  await page.waitForFunction((label) => [...document.querySelectorAll('[role="tab"]')]
    .some((element) => element.textContent.trim() === label && element.getAttribute('aria-selected') === 'true'), name);
}

async function screenshot(page, filename, fullPage = false) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(screenshots, filename), fullPage, animations: 'disabled' });
}

try {
  await readFile(path.join(dist, 'manifest.json'));
  await mkdir(screenshots, { recursive: true });
  profile = await mkdtemp(path.join(os.tmpdir(), 'hubris-e2e-'));
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 380, height: 600 },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
  });
  context.setDefaultTimeout(15_000);
  context.on('console', captureConsole);
  context.on('weberror', (error) => runtimeErrors.push(`runtime: ${error.error().stack ?? error.error().message}`));
  const watchPage = (page) => {
    page.on('console', captureConsole);
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror ${page.url()}: ${error.stack ?? error.message}`));
  };
  context.on('page', watchPage);
  context.pages().forEach(watchPage);
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 30_000 });
  const watchWorker = async (serviceWorker) => {
    serviceWorker.on('console', captureConsole);
    await serviceWorker.evaluate(() => {
      self.addEventListener('error', (event) => console.error(`Service worker error: ${event.message}`));
      self.addEventListener('unhandledrejection', (event) => console.error(`Service worker rejection: ${String(event.reason?.stack ?? event.reason)}`));
    });
  };
  context.on('serviceworker', (serviceWorker) => {
    void watchWorker(serviceWorker).catch((error) => runtimeErrors.push(`Worker monitoring: ${error.message}`));
  });
  await watchWorker(worker);
  const extensionId = new URL(worker.url()).host;
  assert(extensionId, 'Service worker has no extension id');
  const extensionUrl = `chrome-extension://${extensionId}`;

  await step(1, 'fresh-profile onboarding', async () => {
    popup = await context.newPage();
    await popup.goto(`${extensionUrl}/popup.html`);
    await popup.getByText(/Hubris/i).first().waitFor({ state: 'visible' });
    const h2 = popup.locator('h2').first();
    await h2.waitFor({ state: 'visible' });
    const overlayBlocker = await popup.evaluate(() => {
      const heading = document.querySelector('h2');
      if (!heading) throw new Error('onboarding has no h2');
      const rect = heading.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const top = document.elementFromPoint(x, y);
      if (!top || top === heading || heading.contains(top)) return null;
      const tag = top.tagName.toLowerCase();
      const cls = typeof top.className === 'string' ? top.className : '';
      return `${tag}${cls ? ` class="${cls}"` : ''}`;
    });
    assert.equal(overlayBlocker, null, `onboarding h2 covered by ${overlayBlocker}`);
    await screenshot(popup, 'popup-onboarding.png');
  });

  await step(2, 'seed IndexedDB', async () => {
    await popup.evaluate((data) => new Promise((resolve, reject) => {
      const request = indexedDB.open('hubris', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('activities', { keyPath: 'id' });
        const logs = db.createObjectStore('logs', { keyPath: 'id' });
        logs.createIndex('activityId', 'activityId');
        logs.createIndex('loggedAt', 'loggedAt');
        db.createObjectStore('meta');
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB seed is blocked'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['activities', 'logs', 'meta'], 'readwrite');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Seed transaction aborted')); };
        tx.onerror = () => { db.close(); reject(tx.error); };
        tx.objectStore('activities').clear();
        tx.objectStore('logs').clear();
        data.activities.forEach((activity) => tx.objectStore('activities').put(activity));
        data.logs.forEach((log) => tx.objectStore('logs').put(log));
        tx.objectStore('meta').put(true, 'onboardingComplete');
      };
    }), demoData(new Date()));
    await popup.reload();
    await popup.getByRole('tab', { name: 'Today', exact: true }).waitFor();
  });

  await step(3, 'popup tabs and screenshots', async () => {
    for (const name of ['Today', 'Trends', 'History', 'Settings']) {
      await selectTab(popup, name);
      await screenshot(popup, `popup-${name.toLowerCase()}.png`);
    }
  });

  await step(4, 'log and undo', async () => {
    await selectTab(popup, 'Today');
    await popup.getByRole('button', { name: /^Log Leetcode/ }).first().click();
    const toast = popup.getByText('Leetcode logged', { exact: true });
    await toast.waitFor({ state: 'visible' });
    const undo = popup.getByRole('button', { name: 'Undo', exact: true });
    await undo.waitFor({ state: 'visible' });
    await screenshot(popup, 'popup-logged.png');
    await undo.click();
    await toast.waitFor({ state: 'hidden' });
    await undo.waitFor({ state: 'hidden' });
  });

  await step(5, 'responsive side panel', async () => {
    panel = await context.newPage();
    for (const [width, height, filename] of [
      [480, 900, 'sidepanel.png'],
      [1280, 800, 'sidepanel-desktop.png'],
      [360, 740, 'sidepanel-phone.png'],
    ]) {
      await panel.setViewportSize({ width, height });
      await panel.goto(`${extensionUrl}/sidepanel.html`);
      await panel.getByRole('tab', { name: 'Today', exact: true }).waitFor();
      await panel.getByRole('button', { name: /^Log Leetcode/ }).first().waitFor();
      await screenshot(panel, filename, width === 360);
      const dimensions = await panel.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      assert(dimensions.content <= dimensions.viewport, `Horizontal scroll at ${width}x${height}: ${dimensions.content}px`);
    }
  });

  await step(6, 'axe accessibility', async () => {
    const axeSource = await readFile(require.resolve('axe-core'), 'utf8');
    const serious = [];
    for (const [page, names] of [[popup, ['Today', 'Trends', 'History', 'Settings']], [panel, ['Today']]]) {
      // Evaluated over CDP, so the extension's strict CSP stays on and is tested too.
      await page.evaluate(axeSource);
      for (const name of names) {
        await selectTab(page, name);
        const result = await page.evaluate(() => window.axe.run(document));
        const label = `${page === popup ? 'popup' : 'sidepanel'} ${name}`;
        const violations = result.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
        console.log(`axe ${label}: ${result.passes.length} passed rules, ${result.violations.length} violations, ${violations.length} serious/critical`);
        for (const violation of result.violations) {
          console.log(`axe violation ${label}: ${violation.id} (${violation.impact})`);
        }
        serious.push(...violations.map((violation) => `${label}: ${violation.id} (${violation.impact}) ${violation.help} ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`));
      }
    }
    assert.equal(serious.length, 0, serious.join('\n'));
  });

  await step(7, 'keyboard focus is visible on the tab panel', async () => {
    await selectTab(popup, 'Today');
    await popup.getByRole('tab', { name: 'Today', exact: true }).focus();
    let reachedPanel = false;
    for (let presses = 0; presses < 60 && !reachedPanel; presses += 1) {
      await popup.keyboard.press('Shift+Tab');
      reachedPanel = await popup.evaluate(() => document.activeElement?.getAttribute('role') === 'tabpanel');
    }
    assert(reachedPanel, 'Keyboard focus never reached the tab panel');
    const style = await popup.evaluate(() => {
      const panel = document.activeElement;
      const computed = getComputedStyle(panel);
      return { boxShadow: computed.boxShadow, outlineStyle: computed.outlineStyle, outlineWidth: computed.outlineWidth };
    });
    const hasRing = style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && style.outlineWidth !== '0px');
    assert(hasRing, `Focused tab panel has no visible indicator: ${JSON.stringify(style)}`);
  });

  await step(8, 'toolbar badge', async () => {
    const badge = await worker.evaluate(() => chrome.action.getBadgeText({}));
    assert(/^(?:100|[1-9]?\d)$/.test(badge), `Expected badge integer 0 to 100, got ${JSON.stringify(badge)}`);
  });
} catch (error) {
  failed = true;
  console.error(`FAIL Setup: ${error.stack ?? error.message}`);
} finally {
  try {
    await context?.close();
  } catch (error) {
    failed = true;
    console.error(`FAIL Cleanup: ${error.message}`);
  } finally {
    if (profile) await rm(profile, { recursive: true, force: true }).catch((error) => {
      failed = true;
      console.error(`FAIL Profile cleanup: ${error.message}`);
    });
  }
  if (runtimeErrors.length) {
    failed = true;
    console.error(`FAIL Runtime errors (${runtimeErrors.length}):\n${runtimeErrors.join('\n')}`);
  } else {
    console.log('PASS Runtime errors: none');
  }
  if (failed) process.exitCode = 1;
}
