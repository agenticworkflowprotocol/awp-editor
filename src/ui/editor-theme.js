// CodeMirror theme from the viewer's CSS custom properties, so light, dark and embedder colours
// apply to the editor too.
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export const editorTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--awp-fg)', backgroundColor: 'var(--awp-panel)', fontSize: '0.875rem' },
  '.cm-scroller': { fontFamily: 'var(--awp-mono)', lineHeight: '1.5' },
  '.cm-content': { caretColor: 'var(--awp-accent)', padding: '0.5rem 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--awp-accent)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: 'var(--awp-selection)' },
  '.cm-activeLine': { backgroundColor: 'var(--awp-active-line)' },
  '.cm-gutters': { backgroundColor: 'var(--awp-panel)', color: 'var(--awp-muted)', border: 'none', borderRight: '1px solid var(--awp-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--awp-active-line)' },
  '.cm-tooltip': { backgroundColor: 'var(--awp-bg)', color: 'var(--awp-fg)', border: '1px solid var(--awp-line)' },
  '.cm-diagnostic-error': { borderLeftColor: 'var(--awp-bad)' },
  '.cm-diagnostic-warning': { borderLeftColor: 'var(--awp-warn)' },
  '.cm-panels': { backgroundColor: 'var(--awp-panel)', color: 'var(--awp-fg)' },
  '.cm-searchMatch': { backgroundColor: 'var(--awp-active)' },
});

export const highlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: [t.propertyName, t.definition(t.propertyName)], color: 'var(--awp-key)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--awp-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--awp-literal)' },
  { tag: [t.comment, t.lineComment], color: 'var(--awp-muted)', fontStyle: 'italic' },
  { tag: [t.meta, t.labelName, t.typeName], color: 'var(--awp-accent)' },
  { tag: [t.punctuation, t.separator, t.squareBracket, t.brace], color: 'var(--awp-muted)' },
]));
