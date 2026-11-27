# Changelog

All notable changes are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-27

### Added

- AWP `v1alpha4` (decision D23 of the specification). Step conditions (`when`,
  spec 3.12): the view model carries `when`; the graph marks a conditional step with `if` and
  names the condition in the accessible name; the step card gets a "conditional" badge and a
  "When" fact. Workflow steps (`type: workflow`, spec 5.6.6): the view model carries `workflow`
  (`ref`, `version`, `inputs`, `wait`, default `true`); the graph node shows the called workflow;
  the step card shows the child workflow and its inputs; the step exposes the action
  `workflow.start`.
- Governance fields of `v1alpha4` manifests are read from `spec`, as in `v1alpha3`.
- Requires `@agenticworkflowprotocol/validator` 0.4.0 (`v1alpha4`).

### Changed

- `v1alpha4` is the current draft (decision D24 of the specification). The website starts with a
  `v1alpha4` manifest, and `examples/<file>` now serves the `v1alpha4` examples; the `v1alpha3`
  examples moved to `examples/v1alpha3/<file>` and are listed as an older set.
  `examples/v1alpha4/<file>` still works but is no longer listed.
- Viewer and editor show `v1alpha1` to `v1alpha3` manifests as before; the browser test checks a
  `v1alpha3` example explicitly.

## [0.3.0] - 2026-11-25

### Changed

- `v1alpha3` is the current draft (decision D22 of the specification). The website starts with a
  `v1alpha3` manifest, and `examples/<file>` now serves the `v1alpha3` examples; the `v1alpha2`
  examples moved to `examples/v1alpha2/<file>`. `examples/v1alpha3/<file>` still works but is no
  longer listed.
- The page footer lists the AWP versions of the bundled validator instead of a fixed text.
- Viewer and editor show `v1alpha1` and `v1alpha2` manifests as before; the browser test now
  checks a `v1alpha2` example explicitly.
- Uses `@agenticworkflowprotocol/validator` 0.3.0 (`v1alpha3` as the current draft).

## [0.2.0] - 2026-11-20

### Added

- AWP `v1alpha2` step iteration (`forEach`, spec 5.6.4): the view model carries `forEach`
  (`items`, `maxItems`, `concurrency`); the step graph draws an iterating step as stacked cards
  with its bound (for example `each ≤20`) and describes it in the accessible name; the step card
  gets a "for each" badge and a "For each" fact.
- AWP `v1alpha3` (proposed, Kubernetes resource model): version, owner, classification, risk and
  integrity are read from `spec` instead of `metadata`; the facts show `metadata.namespace` and,
  for a `WorkflowRun`, the referenced workflow (`spec.workflowRef`); `type: input` steps appear in
  the step graph as "human input" with a "Human input" fact; keys of `extensions` objects count as
  step extensions. New model fields `namespace`, `governancePointer`, `workflowRef` and step `input`.
- Website: the `v1alpha3` examples under `examples/v1alpha3/`, next to the `v1alpha2` examples.

### Changed

- Requires `@agenticworkflowprotocol/validator` 0.2.0 (`v1alpha1`, `v1alpha2` and `v1alpha3`,
  schema chosen by `apiVersion`); provenance and starter manifest come from `v1alpha2`, the
  current draft.

## [0.1.1] - 2026-11-19

### Changed

- Depends on `@agenticworkflowprotocol/validator` 0.1.0 from the npm registry instead of the release tarball.
- Viewer and editor use the colours of agenticworkflowprotocol.org (teal accent); embedders can still override the CSS custom properties.
- Website: AWP logo, favicons, social preview image and shared navigation with the specification site and the validator.
- Releases are published automatically from `main` with npm provenance.

## [0.1.0] - 2026-11-19

### Added

- `<awp-viewer>`: header, problems, step graph, steps, agents, tools and permissions (static
  decision of permissions, policy shorthands and approval.requiredFor), triggers and inputs,
  budgets, governance, MCP servers, secrets, action groups and extension fields; several documents
  per file; validation with `@agenticworkflowprotocol/validator` 0.1.0.
- `<awp-editor>`: CodeMirror 6 YAML editor next to the viewer, problems in the gutter, cursor
  selects the element in the viewer, a click in the viewer moves the cursor.
- View model for Node.js (`@agenticworkflowprotocol/editor/model`).
- Website (editor.agenticworkflowprotocol.org): editor with examples, open file, download as YAML
  or JSON and share links in the URL fragment; standalone viewer (`viewer.html?url=`); embedding
  guide.
- Tests: view model against the specification examples; browser test in Chrome with the site's
  Content-Security-Policy and axe-core in light and dark mode.

[0.2.0]: https://github.com/agenticworkflowprotocol/awp-editor/releases/tag/v0.2.0
[0.1.1]: https://github.com/agenticworkflowprotocol/awp-editor/releases/tag/v0.1.1
[0.1.0]: https://github.com/agenticworkflowprotocol/awp-editor/releases/tag/v0.1.0
