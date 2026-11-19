// Editor page: toolbar around <awp-editor>. The manifest stays in the browser; share links carry it
// compressed in the URL fragment, which browsers never send to a server.
import { buildModel, parseYaml as parse } from './lib/awp-editor.mjs';
import { decodeShare, encodeShare } from './share.js';

const STARTER = `apiVersion: awp.agenticworkflowprotocol.org/v1alpha2
kind: Workflow
metadata:
  name: hello-workflow
  version: 0.1.0
  description: Summarise a ticket and propose a reply.
  owner:
    team: example-team
  classification: internal
spec:
  inputs:
    - name: ticket
      type: string
      required: true
  budget:
    maxCostUsd: 1.00
    maxSteps: 10
  mcpServers:
    - name: tickets
      transport: streamable-http
      url: https://tickets.example.com/mcp
  agents:
    - id: reader
      model:
        provider: example-provider
        name: example-model
      tools:
        - type: mcp
          server: tickets
          tools: [get_ticket]
    - id: writer
      model:
        provider: example-provider
        name: example-model
      tools:
        - type: mcp
          server: tickets
          tools: [add_comment]
  workflow:
    - id: read
      agent: reader
      task: "Summarise ticket \${{ inputs.ticket }}."
      outputs:
        - name: summary
    - id: reply
      agent: writer
      dependsOn: [read]
      task: "Propose a reply based on: \${{ steps.read.outputs.summary }}"
  permissions:
    default: deny
    tools:
      tickets.get_ticket:
        allow: true
      tickets.add_comment:
        allow: true
  approval:
    requiredFor: [tickets.add_comment]
    approvers:
      - role: support-lead
    timeout: 4h
`;

const $ = (id) => document.getElementById(id);
const editor = $('editor');
const status = $('status');

function say(text) {
  status.textContent = text;
  setTimeout(() => { if (status.textContent === text) status.textContent = ''; }, 3000);
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const baseName = () => buildModel(safeParse(editor.value)).name ?? 'manifest';
function safeParse(text) {
  try { return parse(text); } catch { return undefined; }
}

async function loadExamples() {
  try {
    const { examples } = await (await fetch('examples/index.json')).json();
    for (const name of examples) $('example').append(new Option(name, name));
  } catch {
    $('example').disabled = true;
  }
}

$('example').addEventListener('change', async (e) => {
  if (!e.target.value) return;
  editor.value = await (await fetch(`examples/${encodeURIComponent(e.target.value)}`)).text();
  history.replaceState(null, '', location.pathname);
});
$('file').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (f) editor.value = await f.text();
});
$('download-yaml').addEventListener('click', () => download(`${baseName()}.yaml`, editor.value, 'text/yaml'));
$('download-json').addEventListener('click', () => {
  const value = safeParse(editor.value);
  if (value === undefined) { say('Not valid YAML: cannot convert to JSON.'); return; }
  download(`${baseName()}.json`, `${JSON.stringify(value, null, 2)}\n`, 'application/json');
});
$('share').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}#m=${await encodeShare(editor.value)}`;
  history.replaceState(null, '', url);
  await navigator.clipboard.writeText(url);
  say('Share link copied.');
});
$('profiles').addEventListener('change', (e) => {
  if (e.target.value) editor.setAttribute('profiles', e.target.value);
  else editor.removeAttribute('profiles');
});
editor.addEventListener('change', (e) => {
  const docs = e.detail.documents;
  const errors = docs.flatMap((d) => d.diagnostics).filter((d) => d.severity === 'error').length;
  document.title = `${errors ? `✗ ${errors} · ` : ''}AWP Editor`;
});

async function start() {
  const shared = location.hash.startsWith('#m=') ? await decodeShare(location.hash.slice(3)).catch(() => null) : null;
  editor.value = shared ?? STARTER;
  if (location.hash && shared === null) say('The share link could not be read.');
}

loadExamples();
start();
