// Types of the browser entries @agenticworkflowprotocol/editor/viewer and /editor.
import type { Diagnostic, DocumentResult, FileResult, ManifestResult, ValidateOptions } from '@agenticworkflowprotocol/validator';
import type { Model } from './model';

export type { Diagnostic, DocumentResult, FileResult, ManifestResult, Model };

export interface NavigateDetail {
  /** JSON Pointer of the element the user activated. */
  pointer: string;
  /** Index of the shown document. */
  document: number;
  /** Source position (only when the viewer got text, not a parsed manifest). */
  offset?: number;
  line?: number;
  column?: number;
}

/** <awp-viewer src profiles no-validate theme> */
export class AwpViewer extends HTMLElement {
  /** Manifest text (YAML or JSON, several documents allowed). */
  text: string;
  /** Already parsed manifest (no source positions). */
  manifest: unknown;
  /** Index of the shown document. */
  document: number;
  /** Validation result of the shown document; undefined with `no-validate`. */
  readonly result: ManifestResult | DocumentResult | undefined;
  /** Mark the element at a JSON Pointer (or its closest parent shown). */
  highlight(pointer: string, options?: { scroll?: boolean }): void;
  addEventListener(type: 'awp-navigate', listener: (e: CustomEvent<NavigateDetail>) => void): void;
  addEventListener(type: 'awp-validated', listener: (e: CustomEvent<{ result: ManifestResult | undefined; model: Model }>) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/** <awp-editor src profiles readonly layout theme> */
export class AwpEditor extends HTMLElement {
  /** Current manifest text. */
  value: string;
  /** Validation result per document. */
  readonly result: DocumentResult[];
  /** The embedded viewer. */
  readonly viewer: AwpViewer;
  addEventListener(type: 'change', listener: (e: CustomEvent<{ value: string; documents: DocumentResult[] }>) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

/** Register <awp-viewer> (done on import; call with another name to register a second tag). */
export function defineViewer(name?: string): void;
/** Register <awp-editor> and <awp-viewer> (done on import of the editor entry). */
export function defineEditor(name?: string): void;

export function buildModel(manifest: unknown): Model;
export function validateText(text: string, options?: ValidateOptions & { file?: string }): FileResult;
export function validateManifest(value: unknown, options?: ValidateOptions): ManifestResult;
export function parseYaml(text: string): unknown;
export function stringifyYaml(value: unknown): string;

declare global {
  interface HTMLElementTagNameMap {
    'awp-viewer': AwpViewer;
    'awp-editor': AwpEditor;
  }
}
