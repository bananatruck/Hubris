// Loads the landing page in Chromium and checks two rules:
// 1. No horizontal page overflow at phone and desktop widths.
// 2. Every small text node that assistive technology can reach has at least 4.5:1 contrast
//    (WCAG 2.1, 1.4.3). Text inside role="img" or aria-hidden content is part of a picture and is skipped.
// 3. Content marked as a picture (role="img" or aria-hidden) holds nothing focusable and no landmark,
//    since its children are hidden from assistive technology but a focus stop would remain.
// Run: node scripts/check-site.mjs
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(new URL('../apps/extension/package.json', import.meta.url));
const { chromium } = require('playwright-core');
const page = pathToFileURL(fileURLToPath(new URL('../site/index.html', import.meta.url))).href;
const failures = [];

const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  for (const width of [320, 375, 414, 768, 1280]) {
    const tab = await browser.newPage({ viewport: { width, height: 800 } });
    await tab.goto(page);
    const scrollWidth = await tab.evaluate(() => document.documentElement.scrollWidth);
    const hiddenInteractive = await tab.evaluate(() => [...document.querySelectorAll(
      ':is([role="img"], [aria-hidden="true"]) :is(a[href], button, input, select, textarea, [tabindex], nav, main, aside, [role])',
    )].map((element) => element.outerHTML.slice(0, 80)));
    failures.push(...hiddenInteractive.map((html) => `inside a picture: ${html}`));
    if (scrollWidth > width) failures.push(`overflow at ${width}px: page is ${scrollWidth}px wide`);
    if (width === 1280 || width === 320) {
      const low = await tab.evaluate(() => {
        const parse = (value) => [...value.matchAll(/rgba?\(([^)]*)\)/g)].map(([, body]) => {
          const parts = body.split(/[\s,/]+/).filter(Boolean).map(Number);
          return [parts[0], parts[1], parts[2], parts[3] ?? 1];
        });
        const blend = (top, under) => top.slice(0, 3).map((channel, index) => channel * top[3] + under[index] * (1 - top[3]));
        // Every opaque colour that can sit behind the element's text: gradients give one per stop.
        const behind = (element) => {
          if (!element) return [[255, 255, 255]];
          const style = getComputedStyle(element);
          const stops = style.backgroundImage.includes('gradient') ? parse(style.backgroundImage) : [];
          const base = parse(style.backgroundColor)[0];
          const layers = stops.length ? stops : base && base[3] > 0 ? [base] : null;
          if (!layers) return behind(element.parentElement);
          if (layers.every((color) => color[3] >= 1)) return layers.map((color) => color.slice(0, 3));
          const under = stops.length && base && base[3] >= 1 ? [base.slice(0, 3)] : behind(element.parentElement);
          return layers.flatMap((color) => under.map((background) => blend(color, background)));
        };
        const luminance = (rgb) => {
          const [r, g, b] = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a, b) => {
          const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (light + 0.05) / (dark + 0.05);
        };
        const results = [];
        for (const element of document.body.querySelectorAll('*')) {
          if (!element.checkVisibility() || element.closest('[aria-hidden="true"], [role="img"]')) continue;
          const text = [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('').trim();
          if (!text) continue;
          const style = getComputedStyle(element);
          const size = parseFloat(style.fontSize);
          const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
          if (large) continue;
          const [foreground] = parse(style.color);
          if (!foreground) { results.push(`${text}: unreadable colour ${style.color}`); continue; }
          const backgrounds = behind(element);
          const worst = Math.min(...backgrounds.map((background) => ratio(blend(foreground, background), background)));
          if (worst < 4.5) results.push(`"${text.slice(0, 40)}" (${element.tagName.toLowerCase()}.${element.className || ''}) ${style.color} is ${worst.toFixed(2)}:1`);
        }
        return results;
      });
      failures.push(...low.map((line) => `contrast at ${width}px: ${line}`));
    }
    await tab.close();
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`FAIL ${failures.length} landing page problem(s):\n${[...new Set(failures)].join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('PASS landing page: no horizontal overflow, small text at least 4.5:1');
}
