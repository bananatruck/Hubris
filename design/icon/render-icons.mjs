// Renders hubris-mark.svg to the PNG sizes the extension manifest needs.
// Run: node design/icon/render-icons.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "out");
const svgPath = path.join(__dirname, "hubris-mark.svg");
// playwright-core is a dev dependency of the extension; it finds its own Chromium build.
const { chromium } = await import(
  new URL("../../apps/extension/node_modules/playwright-core/index.mjs", import.meta.url).href
);

const svg = await fs.readFile(svgPath, "utf8");
const sizes = [16, 32, 48, 128];

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    const sizedSvg = svg.replace(
      /width="128" height="128"/,
      `width="${size}" height="${size}"`,
    );
    await page.setContent(
      `<!DOCTYPE html><html><body style="margin:0;background:transparent">${sizedSvg}</body></html>`,
      { waitUntil: "load" },
    );
    const outPath = path.join(outDir, `icon-${size}.png`);
    await page.screenshot({
      path: outPath,
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: true,
      scale: "css",
    });
  }
} finally {
  await browser.close();
}