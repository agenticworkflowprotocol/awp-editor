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

// Examples on the site: the current draft (v1alpha4, decision D24 of the specification) at
// examples/<file>, older versions under examples/<version>/<file>. The current draft is also
// copied to examples/v1alpha4/ without being listed, so links from the time it was the next
// draft keep working.
const EXAMPLE_SETS = [
  { version: 'v1alpha4', dir: '' },
  { version: 'v1alpha3', dir: 'v1alpha3/' },
  { version: 'v1alpha2', dir: 'v1alpha2/' },
  { version: 'v1alpha4', dir: 'v1alpha4/', listed: false },
];

/** Copy the manifest examples of one spec version; returns their paths relative to examples/. */
function copyExamples({ version, dir }, out) {
  const awp = join(validatorDir, 'vendor/awp');
  const source = join(awp, `spec/${version}/examples`);
  const index = join(awp, `conformance/${version}/index.json`);
  const { nonManifestExamples = [] } = JSON.parse(readFileSync(index, 'utf8'));
  const files = readdirSync(source).filter((f) => /\.(ya?ml|json)$/.test(f) && !nonManifestExamples.includes(f)).sort();
  mkdirSync(join(out, 'examples', dir), { recursive: true });
  for (const f of files) cpSync(join(source, f), join(out, 'examples', dir, f));
  return files.map((f) => `${dir}${f}`);
}

function site() {
  const out = join(root, 'dist/site');
  rmSync(out, { recursive: true, force: true });
  cpSync(join(root, 'site'), out, { recursive: true });
  mkdirSync(join(out, 'lib'), { recursive: true });
  for (const f of ['awp-viewer.mjs', 'awp-editor.mjs']) cpSync(join(root, 'dist', f), join(out, 'lib', f));

  const examples = EXAMPLE_SETS.flatMap((set) => {
    const files = copyExamples(set, out);
    return set.listed === false ? [] : files;
  });
  writeFileSync(join(out, 'examples/index.json'), `${JSON.stringify({ examples }, null, 2)}\n`);

  for (const page of readdirSync(out).filter((f) => f.endsWith('.html'))) {
    const p = join(out, page);
    writeFileSync(p, readFileSync(p, 'utf8')
      .replaceAll('{{version}}', pkg.version)
      .replaceAll('{{validatorVersion}}', validatorPkg.version)
      .replaceAll('{{awpVersions}}', [...provenance.awpVersions].reverse().join(', '))
      .replaceAll('{{specCommit}}', provenance.source.commit.slice(0, 7)));
  }
}

rmSync(join(root, 'dist'), { recursive: true, force: true });
await bundle('src/viewer-entry.js', 'dist/awp-viewer.mjs');
await bundle('src/editor-entry.js', 'dist/awp-editor.mjs');
site();
console.log('built dist/awp-viewer.mjs, dist/awp-editor.mjs and dist/site/');
