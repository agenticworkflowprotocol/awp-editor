// <awp-editor>: YAML editor (CodeMirror 6) next to <awp-viewer>, with live validation, problems in
// the gutter and two-way navigation (cursor selects the element, a click in the viewer moves the
// cursor). Everything runs in the browser.
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { yaml } from '@codemirror/lang-yaml';
import { bracketMatching, foldGutter, foldKeymap, indentOnInput, indentUnit } from '@codemirror/language';
import { forceLinting, lintGutter, linter } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { validateText } from '@agenticworkflowprotocol/validator/browser';
import { parseSource, pointerAt } from '../model/index.js';
import { h } from './dom.js';
import { editorTheme, highlighting } from './editor-theme.js';
import editorCss from './editor.css';
import { AwpViewer, defineViewer } from './viewer.js';

const DEBOUNCE_MS = 250;
let sheet;
function editorSheet() {
  if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(editorCss); }
  return sheet;
}

/** CodeMirror diagnostics from validator diagnostics (positions are 1-based line and column). */
function toLint(state, documents) {
  const out = [];
  for (const doc of documents) {
    for (const d of doc.diagnostics) {
      const line = d.source?.line ? state.doc.line(Math.min(d.source.line, state.doc.lines)) : state.doc.line(1);
      const from = Math.min(line.to, line.from + Math.max(0, (d.source?.column ?? 1) - 1));
      const to = from < line.to ? line.to : from;
      out.push({ from, to, severity: d.severity === 'info' ? 'info' : d.severity, source: d.code, message: `${d.message}${d.path ? ` (${d.path})` : ''}` });
    }
  }
  return out;
}

export class AwpEditor extends HTMLElement {
  static observedAttributes = ['src', 'profiles', 'readonly', 'layout', 'theme'];

  #root;
  #view;
  #viewer;
  #readonly = new Compartment();
  #timer;
  #documents = [];

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.adoptedStyleSheets = [editorSheet()];
  }

  connectedCallback() {
    if (this.#view) return;
    defineViewer();
    const pane = h('div', { class: 'code', part: 'code' });
    this.#viewer = document.createElement('awp-viewer');
    this.#viewer.setAttribute('part', 'viewer');
    this.#syncViewerAttributes();
    const viewerPane = h('div', { class: 'preview', part: 'preview' }, this.#viewer);
    this.#root.replaceChildren(h('div', { class: 'layout', part: 'layout' }, pane, viewerPane));

    const initial = this.getAttribute('value') ?? (this.hasAttribute('src') ? '' : this.textContent.replace(/^\n/, ''));
    this.#view = new EditorView({
      root: this.#root,
      parent: pane,
      state: EditorState.create({ doc: initial, extensions: this.#extensions() }),
    });
    this.#viewer.addEventListener('awp-navigate', (e) => this.#jump(e.detail));
    this.#viewer.addEventListener('awp-validated', (e) => e.stopPropagation());
    if (this.hasAttribute('src')) this.#load(this.getAttribute('src'));
    else this.#update();
  }

  attributeChangedCallback(name, oldValue, value) {
    if (oldValue === value || !this.#view) return;
    if (name === 'src' && value) this.#load(value);
    else if (name === 'readonly') this.#view.dispatch({ effects: this.#readonly.reconfigure(EditorState.readOnly.of(value !== null)) });
    else this.#syncViewerAttributes();
    if (name === 'profiles') this.#update();
  }

  /** Current manifest text. */
  get value() { return this.#view ? this.#view.state.doc.toString() : (this.getAttribute('value') ?? ''); }
  set value(text) {
    if (!this.#view) { this.setAttribute('value', String(text ?? '')); return; }
    this.#view.dispatch({ changes: { from: 0, to: this.#view.state.doc.length, insert: String(text ?? '') } });
  }

  /** Validation result per document of the current text. */
  get result() { return this.#documents; }

  /** The embedded <awp-viewer>. */
  get viewer() { return this.#viewer; }

  /** Focus the code editor. */
  focus() { this.#view?.focus(); }

  #extensions() {
    return [
      lineNumbers(), highlightActiveLineGutter(), foldGutter(), history(), drawSelection(), indentOnInput(), bracketMatching(),
      highlightActiveLine(), highlightSelectionMatches(), indentUnit.of('  '), EditorState.tabSize.of(2),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap]),
      yaml(), editorTheme, highlighting, EditorView.lineWrapping,
      this.#readonly.of(EditorState.readOnly.of(this.hasAttribute('readonly'))),
      lintGutter(),
      linter((view) => toLint(view.state, this.#documents), { delay: DEBOUNCE_MS + 50 }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) { clearTimeout(this.#timer); this.#timer = setTimeout(() => this.#update(), DEBOUNCE_MS); }
        else if (u.selectionSet) this.#follow();
      }),
      // Explicit tabindex: keyboard users reach the scrollable editor even when it is read-only.
      EditorView.contentAttributes.of({ 'aria-label': 'AWP manifest (YAML or JSON)', tabindex: '0' }),
    ];
  }

  #syncViewerAttributes() {
    for (const name of ['profiles', 'theme']) {
      const v = this.getAttribute(name);
      if (v === null) this.#viewer.removeAttribute(name);
      else this.#viewer.setAttribute(name, v);
    }
  }

  async #load(url) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.value = await res.text();
    } catch (err) {
      this.value = `# Could not load ${url}: ${err.message}\n`;
    }
  }

  #update() {
    const text = this.value;
    this.#viewer.text = text;
    // All documents for the gutter; the viewer shows one of them.
    this.#documents = this.#validateAll(text);
    forceLinting(this.#view);
    this.#follow();
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true, detail: { value: text, documents: this.#documents } }));
  }

  #validateAll(text) {
    const profiles = this.getAttribute('profiles')?.split(',').map((x) => x.trim()).filter(Boolean);
    try {
      return validateText(text, { file: 'manifest', profiles: profiles?.length ? profiles : undefined }).documents;
    } catch (err) {
      return [{ document: 0, valid: false, diagnostics: [{ severity: 'error', code: 'editor.options', message: err.message, path: '' }] }];
    }
  }

  #follow() {
    const offset = this.#view.state.selection.main.head;
    const { document: index, pointer } = pointerAt(parseSource(this.value), offset);
    if (index !== this.#viewer.document) this.#viewer.document = index;
    this.#viewer.highlight(pointer, { scroll: false });
  }

  #jump({ offset }) {
    if (offset === undefined) return;
    const pos = Math.min(offset, this.#view.state.doc.length);
    this.#view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) });
    this.#view.focus();
  }
}

/** Register <awp-editor> (and <awp-viewer>) once. */
export function defineEditor(name = 'awp-editor') {
  defineViewer();
  if (!customElements.get(name)) customElements.define(name, class extends AwpEditor {});
}

export { AwpViewer };
