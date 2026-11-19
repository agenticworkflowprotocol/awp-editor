// <awp-viewer>: renders an AWP manifest (YAML or JSON) as overview, step graph, agents, tools and
// permissions, budgets and governance, with the validator's findings at each element.
import { validateManifest, validateText } from '@agenticworkflowprotocol/validator/browser';
import { buildModel, locate, parseSource } from '../model/index.js';
import { h } from './dom.js';
import { renderAgents, renderActions, renderServersAndSecrets } from './render-agents.js';
import { renderBudgets, renderExtensions, renderGovernance, renderPolicyRules } from './render-governance.js';
import { renderGraph, renderSteps } from './render-graph.js';
import { renderHeader, renderMetadataFacts, renderProblems, renderTriggersAndInputs } from './render-overview.js';
import viewerCss from './viewer.css';

let sheet;
/** One shared constructable stylesheet: works under a CSP without 'unsafe-inline'. */
export function viewerSheet() {
  if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(viewerCss); }
  return sheet;
}

const parseProfiles = (value) => (value ? value.split(',').map((p) => p.trim()).filter(Boolean) : undefined);

export class AwpViewer extends HTMLElement {
  static observedAttributes = ['src', 'profiles', 'no-validate', 'theme'];

  #text = '';
  #manifest;
  #source;
  #document = 0;
  #result;
  #selected;
  #root;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.adoptedStyleSheets = [viewerSheet()];
  }

  connectedCallback() {
    if (this.hasAttribute('src') && !this.#text && !this.#manifest) this.#load(this.getAttribute('src'));
    else if (!this.#text && !this.#manifest && this.textContent.trim()) this.text = this.textContent;
    else this.#render();
  }

  attributeChangedCallback(name, oldValue, value) {
    if (oldValue === value || !this.isConnected) return;
    if (name === 'src' && value) this.#load(value);
    else this.#render();
  }

  /** Manifest text (YAML or JSON, several documents allowed). */
  get text() { return this.#text; }
  set text(value) {
    this.#text = String(value ?? '');
    this.#manifest = undefined;
    this.#source = parseSource(this.#text);
    this.#document = Math.min(this.#document, Math.max(0, this.#source.docs.length - 1));
    this.#render();
  }

  /** Already parsed manifest (no source positions). */
  get manifest() { return this.#manifest ?? this.#source?.docs[this.#document]?.toJS(); }
  set manifest(value) {
    this.#manifest = value;
    this.#text = '';
    this.#source = undefined;
    this.#document = 0;
    this.#render();
  }

  /** Validation result of the shown document, or undefined with `no-validate`. */
  get result() { return this.#result; }

  /** Index of the shown document. */
  get document() { return this.#document; }
  set document(i) { this.#document = Number(i) || 0; this.#render(); }

  /** Mark the element at a JSON Pointer (or its closest parent that the viewer shows). */
  highlight(pointer, { scroll = true } = {}) {
    this.#selected = pointer;
    const target = this.#closest(pointer);
    for (const el of this.#root.querySelectorAll('.active')) el.classList.remove('active');
    if (!target) return;
    target.classList.add('active');
    if (scroll && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  async #load(url) {
    this.#status(`Loading ${url} …`);
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.text = await res.text();
    } catch (err) {
      this.#status(`Could not load ${url}: ${err.message}`, true);
    }
  }

  #status(message, error = false) {
    this.#root.replaceChildren(h('div', { class: ['empty', error ? 'error' : null], role: error ? 'alert' : 'status' }, message));
  }

  #validate() {
    if (this.hasAttribute('no-validate')) return undefined;
    const profiles = parseProfiles(this.getAttribute('profiles'));
    try {
      if (this.#manifest !== undefined) return validateManifest(this.#manifest, { profiles });
      return validateText(this.#text, { file: 'manifest', profiles }).documents[this.#document];
    } catch (err) {
      return { valid: false, diagnostics: [{ severity: 'error', code: 'viewer.options', message: err.message, path: '' }] };
    }
  }

  #closest(pointer) {
    if (pointer === undefined) return null;
    let best = null;
    let bestLength = -1;
    for (const el of this.#root.querySelectorAll('[data-pointer]')) {
      const p = el.getAttribute('data-pointer');
      if ((pointer === p || pointer.startsWith(`${p}/`)) && p.length > bestLength) { best = el; bestLength = p.length; }
    }
    return best;
  }

  #navigate(pointer) {
    const pos = this.#source ? locate(this.#source, this.#document, pointer) : undefined;
    this.highlight(pointer);
    this.dispatchEvent(new CustomEvent('awp-navigate', { bubbles: true, composed: true, detail: { pointer, document: this.#document, ...(pos ?? {}) } }));
  }

  #render() {
    const empty = this.#manifest === undefined && !this.#text.trim();
    if (empty) { this.#status('No manifest.'); return; }
    this.#result = this.#validate();
    const value = this.manifest;
    const model = buildModel(value);
    const diagnostics = this.#result?.diagnostics ?? [];
    const ctx = {
      problemsAt: (pointer) => diagnostics.filter((d) => d.path === pointer || d.path.startsWith(`${pointer}/`)).length,
      navigate: (pointer) => this.#navigate(pointer),
      select: (pointer) => this.#navigate(pointer),
    };
    const docs = this.#source?.docs.length ?? 1;
    const picker = docs > 1 ? h('nav', { class: 'docs', 'aria-label': 'Documents' }, Array.from({ length: docs }, (_, i) => {
      const m = buildModel(this.#source.docs[i].toJS());
      return h('button', { type: 'button', class: ['doc', i === this.#document ? 'current' : null], 'aria-pressed': String(i === this.#document), onclick: () => { this.document = i; } },
        `${i + 1}. ${m.kind ?? '?'} ${m.name ?? ''}`.trim());
    })) : null;
    this.dispatchEvent(new CustomEvent('awp-validated', { bubbles: true, composed: true, detail: { result: this.#result, model } }));
    this.#root.replaceChildren(h('div', { class: 'viewer', part: 'viewer' },
      picker,
      renderHeader(model, this.#result),
      renderMetadataFacts(model),
      renderProblems(this.#result, ctx.navigate),
      renderGraph(model, ctx),
      renderSteps(model, ctx),
      renderAgents(model, ctx),
      renderActions(model),
      renderPolicyRules(model),
      renderTriggersAndInputs(model),
      renderBudgets(model),
      renderGovernance(model),
      renderServersAndSecrets(model),
      renderExtensions(model, ctx)));
    if (this.#selected) this.highlight(this.#selected, { scroll: false });
  }
}

/** Register <awp-viewer> once. */
export function defineViewer(name = 'awp-viewer') {
  if (!customElements.get(name)) customElements.define(name, class extends AwpViewer {});
}
