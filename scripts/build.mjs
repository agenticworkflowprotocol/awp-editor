#!/usr/bin/env node
// Builds the two browser bundles and the website.
//
//   dist/awp-viewer.mjs   <awp-viewer> with the validator (no CodeMirror)
//   dist/awp-editor.mjs   <awp-editor> and <awp-viewer> with CodeMirror 6
//   dist/site/            editor.agenticworkflowprotocol.org (Cloudflare Pages)
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const validatorDir = join(root, 'node_modules/@agenticworkflowprotocol/validator');
const validatorPkg = JSON.parse(readFileSync(join(validatorDir, 'package.json'), 'utf8'));
const provenance = JSON.parse(readFileSync(join(validatorDir, 'vendor/awp/PROVENANCE.json'), 'utf8'));

async function bundle(entry, out) {
  const banner = `/*! @agenticworkflowprotocol/editor ${pkg.version} | Apache-2.0 | bundles @agenticworkflowprotocol/validator ${validatorPkg.version} (Apache-2.0), yaml (ISC)${out.includes('editor') ? ', CodeMirror 6 and Lezer (MIT)' : ''} */`;
  await build({
    entryPoints: [join(root, entry)],
    outfile: join(root, out),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: true,
    sourcemap: true,
    legalComments: 'none',
    loader: { '.css': 'text' },
    banner: { js: banner },
    logLevel: 'warning',
  });
}

function site() {
  const out = join(root, 'dist/site');
  rmSync(out, { recursive: true, force: true });
  cpSync(join(root, 'site'), out, { recursive: true });
  mkdirSync(join(out, 'lib'), { recursive: true });
  for (const f of ['awp-viewer.mjs', 'awp-editor.mjs']) cpSync(join(root, 'dist', f), join(out, 'lib', f));

  const examplesDir = join(validatorDir, 'vendor/awp/spec/v1alpha2/examples');
  const { nonManifestExamples = [] } = JSON.parse(readFileSync(join(validatorDir, 'vendor/awp/conformance/index.json'), 'utf8'));
  const examples = readdirSync(examplesDir).filter((f) => /\.(ya?ml|json)$/.test(f) && !nonManifestExamples.includes(f)).sort();
  mkdirSync(join(out, 'examples'), { recursive: true });
  for (const f of examples) cpSync(join(examplesDir, f), join(out, 'examples', f));
  writeFileSync(join(out, 'examples/index.json'), `${JSON.stringify({ examples }, null, 2)}\n`);

  for (const page of readdirSync(out).filter((f) => f.endsWith('.html'))) {
    const p = join(out, page);
    writeFileSync(p, readFileSync(p, 'utf8')
      .replaceAll('{{version}}', pkg.version)
      .replaceAll('{{validatorVersion}}', validatorPkg.version)
      .replaceAll('{{specCommit}}', provenance.source.commit.slice(0, 7)));
  }
}

rmSync(join(root, 'dist'), { recursive: true, force: true });
await bundle('src/viewer-entry.js', 'dist/awp-viewer.mjs');
await bundle('src/editor-entry.js', 'dist/awp-editor.mjs');
site();
console.log('built dist/awp-viewer.mjs, dist/awp-editor.mjs and dist/site/');
