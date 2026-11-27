#!/usr/bin/env node
// Browser test of the built site (dist/site) in Chrome: a static server with the CSP of
// site/_headers, functional checks of editor, viewer and embed page, and axe-core in light and
// dark mode. Needs an installed Chrome (CHROME_PATH or the default install location).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = resolve(fileURLToPath(new URL('../../dist/site', import.meta.url)));
const axeSource = readFileSync(fileURLToPath(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url)), 'utf8');
if (!existsSync(root)) { console.error('dist/site missing: run npm run build'); process.exit(2); }

const headers = Object.fromEntries(readFileSync(join(root, '_headers'), 'utf8').split('\n').slice(1).filter((l) => l.trim()).map((l) => {
  const i = l.indexOf(':');
  return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
}));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.yaml': 'text/yaml', '.map': 'application/json' };
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  const found = existsSync(p);
  res.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(found ? p : '.html')] ?? 'application/octet-stream', ...headers });
  res.end(readFileSync(found ? p : join(root, '404.html')));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const executablePath = process.env.CHROME_PATH ?? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync);
const browser = await chromium.launch(executablePath ? { executablePath } : { channel: 'chrome' });
const failures = [];
const check = (ok, message) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`); if (!ok) failures.push(message); };

async function page(path, { colorScheme = 'light' } = {}) {
  const context = await browser.newContext({ colorScheme });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const p = await context.newPage();
  const errors = [];
  const external = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('request', (r) => { if (!r.url().startsWith(base)) external.push(r.url()); });
  await p.goto(base + path);
  return { p, errors, external, close: () => context.close() };
}

const viewerText = (p, selector) => p.evaluate((sel) => {
  const host = document.querySelector('awp-editor')?.shadowRoot.querySelector('awp-viewer') ?? document.querySelector('awp-viewer');
  return [...host.shadowRoot.querySelectorAll(sel)].map((n) => n.textContent);
}, selector);

// 1. Editor: starter manifest, graph, problems, navigation, examples, share link.
{
  const { p, errors, external, close } = await page('');
  await p.waitForFunction(() => document.querySelector('awp-editor')?.shadowRoot?.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check((await viewerText(p, '.title'))[0]?.startsWith('hello-workflow'), 'editor shows the starter manifest in the viewer');
  check((await viewerText(p, '.node')).length === 2, 'step graph has two nodes');
  check((await viewerText(p, '.head .badge.ok')).some((t) => t.startsWith('valid')), 'starter manifest is valid');

  await p.locator('awp-editor .cm-content').click();
  await p.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End');
  await p.keyboard.type('\n# comment\n');
  const editor = p.locator('awp-editor');
  await editor.evaluate((el) => { el.value = el.value.replace('dependsOn: [read]', 'dependsOn: [ghost]'); });
  await p.waitForFunction(() => document.querySelector('awp-editor').shadowRoot.querySelector('awp-viewer').shadowRoot.querySelector('.problem.error'));
  check((await viewerText(p, '.problem code')).includes('dependsOn.unknown-step'), 'viewer lists dependsOn.unknown-step');
  await p.waitForFunction(() => document.querySelector('awp-editor').shadowRoot.querySelector('.cm-lint-marker-error'));
  check(true, 'editor gutter shows the error');

  await p.evaluate(() => document.querySelector('awp-editor').shadowRoot.querySelector('awp-viewer').shadowRoot.querySelector('.node[data-pointer="/spec/workflow/1"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  const line = await p.evaluate(() => {
    const root = document.querySelector('awp-editor').shadowRoot;
    return root.querySelector('.cm-activeLine')?.textContent ?? '';
  });
  check(line.includes('- id: reply'), `click on step "reply" moves the cursor to its line (got "${line.trim()}")`);

  await p.selectOption('#example', 'vulnerability-fixer.workflow.yaml');
  await p.waitForFunction(() => document.querySelector('awp-editor').shadowRoot.querySelector('awp-viewer').shadowRoot.querySelector('.title')?.textContent.startsWith('vulnerability-fixer'));
  check((await viewerText(p, '.node')).length === 3, 'example vulnerability-fixer has three steps');
  check((await viewerText(p, '#awp-actions tbody tr')).length > 3, 'tools and permissions table is filled');

  // The examples at the top level are the current draft v1alpha3: version from spec, valid.
  check((await p.locator('awp-editor').evaluate((el) => el.value)).includes('/v1alpha3'), 'the top-level examples are v1alpha3');
  check((await viewerText(p, '.title .version')).join().trim() !== '', 'v1alpha3 example shows its version from spec');
  check((await viewerText(p, '.head .badge')).some((t) => t.startsWith('valid')), 'v1alpha3 example is valid');

  // Older versions stay supported: a v1alpha2 example from the subfolder, version from metadata, valid.
  await p.selectOption('#example', 'v1alpha2/vulnerability-fixer.workflow.yaml');
  await p.waitForFunction(() => document.querySelector('awp-editor').shadowRoot.querySelector('awp-viewer').shadowRoot.querySelector('.api')?.textContent.endsWith('/v1alpha2'));
  check((await viewerText(p, '.title .version')).join().trim() !== '', 'v1alpha2 example shows its version from metadata');
  check((await viewerText(p, '.head .badge')).some((t) => t.startsWith('valid')), 'v1alpha2 example is valid');

  await p.click('#share');
  await p.waitForFunction(() => location.hash.startsWith('#m='));
  const shared = await p.evaluate(() => location.href);
  const before = await editor.evaluate((el) => el.value);
  await p.goto('about:blank');
  await p.goto(shared);
  await p.waitForFunction(() => document.querySelector('awp-editor')?.shadowRoot?.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check((await p.locator('awp-editor').evaluate((el) => el.value)) === before, 'share link restores the manifest');
  check(errors.length === 0, `editor page has no console errors ${errors.join(' | ')}`);
  check(external.length === 0, `editor page makes no external requests ${external.join(' ')}`);
  await close();
}

// 2. Standalone viewer and embed page.
{
  const { p, errors, external, close } = await page('viewer.html?url=examples/invoice-processing.workflow.yaml');
  await p.waitForFunction(() => document.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check((await viewerText(p, '.title'))[0]?.startsWith('invoice-processing'), 'viewer.html shows the manifest of ?url=');
  check(errors.length === 0 && external.length === 0, 'viewer page: no console errors, no external requests');
  await close();
}
{
  // v1alpha2 iteration (spec 5.6.4): marker in the graph, badge and description on the step card.
  const { p, errors, close } = await page('viewer.html?url=examples/v1alpha2/image-review.workflow.yaml');
  await p.waitForFunction(() => document.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check((await viewerText(p, '.node.for-each .node-each')).join() === 'each ≤20', 'iterating step shows its bound in the graph');
  const label = await p.evaluate(() => document.querySelector('awp-viewer').shadowRoot.querySelector('.node.for-each').getAttribute('aria-label'));
  check(label.includes('runs once per item of steps.images.outputs.refs, at most 20 items, 2 at a time'), 'iterating step has an accessible description');
  check((await viewerText(p, '.badge.for-each')).length === 1, 'step card has a for-each badge');
  check(errors.length === 0, 'viewer renders v1alpha2 without errors');
  await close();
}
{
  // v1alpha3 WorkflowRun: namespace and referenced workflow in the facts. The examples/v1alpha3/
  // path is kept for links from the time v1alpha3 was a proposed draft.
  const { p, errors, close } = await page('viewer.html?url=examples/v1alpha3/vulnerability-fixer.run.yaml');
  await p.waitForFunction(() => document.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  const text = await p.evaluate(() => document.querySelector('awp-viewer').shadowRoot.textContent);
  check(text.includes('security') && text.includes('vulnerability-fixer@0.1.0'), 'v1alpha3 run shows namespace and workflow');
  check(errors.length === 0, 'viewer renders v1alpha3 without errors');
  await close();
}
{
  // v1alpha4 (next draft): conditional workflow step with the called workflow on the node.
  const { p, errors, close } = await page('viewer.html?url=examples/v1alpha4/cve-risk-then-fix.yaml');
  await p.waitForFunction(() => document.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check((await viewerText(p, '.node.type-workflow .node-sub')).join() === 'workflow cve-fixer', 'workflow step shows the called workflow');
  const label = await p.evaluate(() => document.querySelector('awp-viewer').shadowRoot.querySelector('.node.conditional').getAttribute('aria-label'));
  check(label.includes('only when steps.risk.outputs.affected == true'), 'conditional step has an accessible description');
  check((await viewerText(p, '.badge.when')).length === 1, 'step card has a conditional badge');
  check((await viewerText(p, '.head .badge')).some((t) => t.startsWith('valid')), 'v1alpha4 example is valid');
  check(errors.length === 0, 'viewer renders v1alpha4 without errors');
  await close();
}
{
  const { p, errors, close } = await page('embed.html');
  await p.waitForFunction(() => document.querySelector('awp-viewer')?.shadowRoot?.querySelector('.title'));
  check(errors.length === 0, 'embed page renders the live example without errors');
  await close();
}

// 3. Accessibility of every page in both colour schemes (axe needs an inline script: bypass CSP).
for (const colorScheme of ['light', 'dark']) {
  for (const path of ['', 'viewer.html?url=examples/vulnerability-fixer.workflow.yaml', 'viewer.html?url=examples/v1alpha2/image-review.workflow.yaml', 'viewer.html?url=examples/vulnerability-fixer.run.yaml', 'viewer.html?url=examples/v1alpha4/cve-risk-then-fix.yaml', 'embed.html']) {
    const context = await browser.newContext({ colorScheme, bypassCSP: true });
    const p = await context.newPage();
    await p.goto(base + path);
    await p.waitForFunction(() => {
      const v = document.querySelector('awp-editor')?.shadowRoot?.querySelector('awp-viewer') ?? document.querySelector('awp-viewer');
      return v?.shadowRoot?.querySelector('.title');
    });
    await p.addScriptTag({ content: axeSource });
    const violations = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
      .map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(', ')}`));
    check(violations.length === 0, `axe ${colorScheme} /${path.split('?')[0]}: ${violations.join('; ') || 'no violations'}`);
    await context.close();
  }
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} browser check(s) failed` : '\nbrowser checks passed');
process.exit(failures.length ? 1 : 0);
