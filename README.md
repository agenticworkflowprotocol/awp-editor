# AWP Editor

[![npm](https://img.shields.io/npm/v/@agenticworkflowprotocol/editor?label=npm)](https://www.npmjs.com/package/@agenticworkflowprotocol/editor) [![ci](https://github.com/agenticworkflowprotocol/awp-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/agenticworkflowprotocol/awp-editor/actions/workflows/ci.yml) [![license](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

Viewer and editor for [Agentic Workflow Protocol (AWP)](https://agenticworkflowprotocol.org)
manifests: step graph, agents, tools, permissions, approvals and budgets at a glance, with live
validation by the [AWP validator](https://github.com/agenticworkflowprotocol/awp-validator).
Embeddable like Swagger UI; runs entirely in the browser.

- **Editor:** [editor.agenticworkflowprotocol.org](https://editor.agenticworkflowprotocol.org) – YAML
  on the left, the rendered manifest on the right, problems in the gutter, examples, download as
  YAML or JSON, share links (the manifest travels in the URL fragment, not to a server).
- **Viewer:** [editor.agenticworkflowprotocol.org/viewer.html](https://editor.agenticworkflowprotocol.org/viewer.html)
  – read-only, `viewer.html?url=https://…/workflow.yaml` shows any manifest your browser can fetch.
- **Embed:** two Web Components, `<awp-viewer>` and `<awp-editor>`, for applications, developer
  portals and documentation ([embedding guide](https://editor.agenticworkflowprotocol.org/embed.html)).

Status: alpha, like the specification (AWP `v1alpha1`).

## What the viewer shows

| Section | Content |
| --- | --- |
| Header | Kind, name, version, owner, classification, risk, validation status |
| Problems | Findings of the validator, each linked to its element and line |
| Workflow | Step graph from `dependsOn` (agent, command and approval steps) |
| Steps, Agents | Task, outputs, timeout, retries; model, tools, instructions |
| Tools and permissions | Every exposed action with the static decision of `permissions`, policy shorthands and `approval.requiredFor` |
| Triggers and inputs, Budgets, Governance | Start conditions, nested limits, approval, policies, data and model policy, audit |
| MCP servers, secrets, action groups | Connections and grants |
| Extension fields | Every `x-` field with its location |

The permissions view is static: it shows what the manifest says. `Policy` manifests, data and model
policies and runtime rules can still deny an action or require approval at run time.

## Install

```sh
npm install --save-exact @agenticworkflowprotocol/editor
```

Every push to `main` with a new `version` in `package.json` is released automatically: tag, GitHub release and npm with provenance (`.github/workflows/publish.yml`). Without registry access, install the
tarball of a [GitHub release](https://github.com/agenticworkflowprotocol/awp-editor/releases):

```sh
npm install --save-exact \
  https://github.com/agenticworkflowprotocol/awp-editor/releases/download/v0.1.1/agenticworkflowprotocol-editor-0.1.1.tgz
```

The release also contains `awp-viewer.mjs` and `awp-editor.mjs` as single files and `SHA256SUMS`.
The package depends on `@agenticworkflowprotocol/validator` from npm.

## Embed

```html
<script type="module" src="/assets/awp-viewer.mjs"></script>
<awp-viewer src="/workflows/vulnerability-fixer.yaml" profiles="core,governance,mcp"></awp-viewer>
```

```html
<script type="module" src="/assets/awp-editor.mjs"></script>
<awp-editor src="/workflows/vulnerability-fixer.yaml" profiles="core,mcp"></awp-editor>
```

With a bundler (React, Vue, Angular, Vite, webpack):

```js
import '@agenticworkflowprotocol/editor/viewer';   // registers <awp-viewer>
import '@agenticworkflowprotocol/editor/editor';   // registers <awp-editor> and <awp-viewer>

const viewer = document.querySelector('awp-viewer');
viewer.text = yamlText;              // YAML or JSON, several documents allowed
viewer.manifest = parsedManifest;    // or a parsed object
viewer.addEventListener('awp-navigate', (e) => openSource(e.detail.pointer, e.detail.line));

const editor = document.querySelector('awp-editor');
editor.addEventListener('change', (e) => save(e.detail.value, e.detail.documents));
```

| Attribute | Element | Meaning |
| --- | --- | --- |
| `src` | both | URL of a manifest to load (fetched without credentials). |
| `profiles` | both | Conformance profiles your runtime supports, comma-separated; fields of other profiles are errors. Default: all. |
| `theme` | both | `light` or `dark`; default follows the system. |
| `no-validate` | viewer | Show without validation. |
| `layout` | editor | `split` (default), `stacked`, `editor` or `viewer`. |
| `readonly` | editor | Code cannot be edited. |

Styling: CSS custom properties such as `--awp-accent`, `--awp-bg`, `--awp-fg`, `--awp-font` and
`--awp-editor-height`; parts `header`, `section`, `viewer`, `code`, `preview`. Both components
render into an open Shadow DOM and use constructable stylesheets, so they work under a
Content-Security-Policy without `unsafe-inline` or `unsafe-eval` and load nothing from other
origins. Text from manifests is always inserted as text, never as HTML.

The view model is also available without a browser, for example to render summaries on a server:

```js
import { buildModel } from '@agenticworkflowprotocol/editor/model';
const model = buildModel(parsedManifest); // agents, steps, graph, actions, budgets, …
```

## Development

```sh
npm ci
npm test               # builds dist/, then runs the model tests
npm run test:browser   # editor, viewer and embed page in Chrome (CSP of site/_headers, axe-core)
```

`dist/site/` is deployed by the Cloudflare Pages project `awp-editor` (build command
`npm ci && npm run build`, output directory in `wrangler.toml`).

## Releasing

1. Set the new `version` in `package.json` (semantic versioning) and add a `## [x.y.z]` section to
   `CHANGELOG.md`.
2. Push to `main` (directly or by merging a pull request).

The `publish` workflow runs on every push to `main`. If the version is not on npm yet, it runs the
tests, tags the commit `vx.y.z`, creates the GitHub release with the artefacts and publishes to npm
through trusted publishing. Pushes without a new version stop after the check.

## License

Apache-2.0. The bundles include the AWP validator (Apache-2.0), yaml (ISC) and, in
`awp-editor.mjs`, CodeMirror 6 and Lezer (MIT).

AWP provides machine-readable governance primitives that can help organizations implement and
enforce their own compliance requirements. Compliance depends on the implementation,
organizational controls and applicable regulatory requirements.
