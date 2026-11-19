// Types of @agenticworkflowprotocol/editor/model: the view model, usable without a browser.

export interface Decision {
  allowed: boolean;
  reason: string;
  key?: string;
  resources?: string[];
}

export interface Action {
  /** Action identifier, for example `github.create_pull_request` (spec 5.5.3). */
  action: string;
  /** Agents (and `step <id>` for command steps) that have the action. */
  exposedTo: string[];
  /** `listed` in a tool source, or known for a source that exposes all tools of its server. */
  exposure: 'listed' | 'all-tools';
  groups: string[];
  permission: (Decision & { by: string; levels: (Decision & { scope: string })[] })[];
  /** Allowed by permissions for at least one agent or step that has it. */
  allowed: boolean;
  /** Policy shorthands that deny it (spec 8.1). */
  deniedByPolicy: string[];
  /** Keys of approval.requiredFor that match it (spec 7.6). */
  approval: string[];
}

export interface Model {
  apiVersion?: string;
  kind?: string;
  name?: string;
  version?: string;
  description?: string;
  purpose?: string;
  owner: { team?: string; contact?: string };
  classification?: string;
  risk?: { level?: string; category: string[] };
  agents: { id: string; pointer: string; form: 'inline' | 'reference' | 'remote'; model?: Record<string, string | undefined>; tools: { type: string; server?: string; name?: string; tools: string[] | null }[]; [key: string]: unknown }[];
  steps: {
    id: string; pointer: string; type: string; agent?: string; task?: string; dependsOn: string[]; outputs: { name: string }[]; extensions: string[];
    /** Iteration (v1alpha2, spec 5.6.4): `items` without `${{ }}`, for example `steps.images.outputs.refs`. */
    forEach?: { items: string; maxItems?: number; concurrency: number };
    [key: string]: unknown;
  }[];
  graph: { nodes: { id: string; level: number; x: number; y: number }[]; edges: { from: string; to: string }[]; width: number; height: number };
  actions: Action[];
  budgets: { scope: string; pointer: string; budget: Record<string, unknown> }[];
  extensions: { name: string; pointer: string; value: unknown }[];
  [key: string]: unknown;
}

export function buildModel(manifest: unknown): Model;
export function decide(permissions: unknown, action: string, groups?: Record<string, string[]>): Decision;
export function layoutSteps(steps: { id: string; dependsOn?: string[] }[]): Model['graph'];
export interface Source { docs: unknown[] }
export function parseSource(text: string): Source;
export function locate(source: Source, document: number, pointer: string): { offset: number; line: number; column: number } | undefined;
export function pointerAt(source: Source, offset: number): { document: number; pointer: string };
